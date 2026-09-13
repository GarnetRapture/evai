#include "context_database/context_database.h"

#include <algorithm>
#include <cstdint>
#include <filesystem>
#include <memory>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

#include <sqlite3.h>

#include "json_text/json_text.h"

namespace eversoul::native {
namespace {

using Statement = std::unique_ptr<sqlite3_stmt, decltype(&sqlite3_finalize)>;

[[noreturn]] void fail(sqlite3* database, std::string_view operation) {
    throw std::runtime_error(std::string(operation) + ": " + sqlite3_errmsg(database));
}

void execute(sqlite3* database, const char* sql) {
    char* error = nullptr;
    if (sqlite3_exec(database, sql, nullptr, nullptr, &error) != SQLITE_OK) {
        const std::string detail = error == nullptr ? sqlite3_errmsg(database) : error;
        sqlite3_free(error);
        throw std::runtime_error(detail);
    }
}

Statement prepare(sqlite3* database, const char* sql) {
    sqlite3_stmt* raw = nullptr;
    if (sqlite3_prepare_v2(database, sql, -1, &raw, nullptr) != SQLITE_OK) {
        fail(database, "prepare");
    }
    return Statement(raw, sqlite3_finalize);
}

void bindText(sqlite3* database, sqlite3_stmt* statement, int index, std::string_view value) {
    if (sqlite3_bind_text(statement, index, value.data(), static_cast<int>(value.size()), SQLITE_TRANSIENT) != SQLITE_OK) {
        fail(database, "bind");
    }
}

void stepDone(sqlite3* database, sqlite3_stmt* statement) {
    if (sqlite3_step(statement) != SQLITE_DONE) {
        fail(database, "step");
    }
}

void ensureFlexibleMemoryTypes(sqlite3* database) {
    auto schema = prepare(database, "SELECT sql FROM sqlite_master WHERE type='table' AND name='memories'");
    if (sqlite3_step(schema.get()) != SQLITE_ROW) return;
    const auto* schemaText = sqlite3_column_text(schema.get(), 0);
    const std::string definition = schemaText == nullptr ? std::string{} : reinterpret_cast<const char*>(schemaText);
    if (definition.find("CHECK(memory_type") == std::string::npos) return;
    schema.reset();

    execute(database, "PRAGMA foreign_keys=OFF");
    try {
        execute(database, R"SQL(
            BEGIN IMMEDIATE;
            ALTER TABLE memory_sources RENAME TO memory_sources_legacy;
            ALTER TABLE memories RENAME TO memories_legacy;
            CREATE TABLE memories(
                id TEXT PRIMARY KEY,
                persona_id TEXT NOT NULL,
                room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
                memory_type TEXT NOT NULL,
                memory_text TEXT NOT NULL,
                created_at TEXT NOT NULL
            ) STRICT;
            INSERT INTO memories SELECT id,persona_id,room_id,memory_type,memory_text,created_at FROM memories_legacy;
            CREATE TABLE memory_sources(
                memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
                message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
                PRIMARY KEY(memory_id, message_id)
            ) STRICT;
            INSERT INTO memory_sources SELECT memory_id,message_id FROM memory_sources_legacy;
            DROP TABLE memory_sources_legacy;
            DROP TABLE memories_legacy;
            CREATE INDEX memories_persona_type_time ON memories(persona_id, memory_type, created_at);
            COMMIT;
        )SQL");
    }
    catch (...) {
        sqlite3_exec(database, "ROLLBACK", nullptr, nullptr, nullptr);
        execute(database, "PRAGMA foreign_keys=ON");
        throw;
    }
    execute(database, "PRAGMA foreign_keys=ON");
}

std::string columnText(sqlite3_stmt* statement, int column) {
    const auto* text = sqlite3_column_text(statement, column);
    return text == nullptr ? std::string{} : reinterpret_cast<const char*>(text);
}

class Transaction {
public:
    explicit Transaction(sqlite3* database) : database_(database) { execute(database_, "BEGIN IMMEDIATE"); }
    ~Transaction() {
        if (!committed_) {
            sqlite3_exec(database_, "ROLLBACK", nullptr, nullptr, nullptr);
        }
    }
    void commit() {
        execute(database_, "COMMIT");
        committed_ = true;
    }
private:
    sqlite3* database_;
    bool committed_ = false;
};

void appendJsonString(std::string& output, std::string_view key, std::string_view value, bool comma) {
    if (comma) {
        output.push_back(',');
    }
    output += '"' + jsonEscape(key) + "\":\"" + jsonEscape(value) + '"';
}

}

ContextDatabase::ContextDatabase(const std::filesystem::path& path) {
#ifdef _WIN32
    const std::wstring nativePath = path.wstring();
    if (sqlite3_open16(nativePath.c_str(), &database_) != SQLITE_OK) {
#else
    if (sqlite3_open(path.string().c_str(), &database_) != SQLITE_OK) {
#endif
        const std::string detail = database_ == nullptr ? "sqlite_open_failed" : sqlite3_errmsg(database_);
        sqlite3_close(database_);
        database_ = nullptr;
        throw std::runtime_error(detail);
    }
    sqlite3_busy_timeout(database_, 5000);
    execute(database_, "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA temp_store=MEMORY;");
    execute(database_, R"SQL(
        CREATE TABLE IF NOT EXISTS rooms(
            id TEXT PRIMARY KEY,
            persona_id TEXT NOT NULL,
            updated_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS messages(
            id TEXT PRIMARY KEY,
            room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
            persona_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user','assistant')),
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        ) STRICT;
        CREATE INDEX IF NOT EXISTS messages_room_time ON messages(room_id, created_at);
        CREATE INDEX IF NOT EXISTS messages_persona_time ON messages(persona_id, created_at);
        CREATE TABLE IF NOT EXISTS memories(
            id TEXT PRIMARY KEY,
            persona_id TEXT NOT NULL,
            room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
            memory_type TEXT NOT NULL,
            memory_text TEXT NOT NULL,
            created_at TEXT NOT NULL
        ) STRICT;
        CREATE INDEX IF NOT EXISTS memories_persona_type_time ON memories(persona_id, memory_type, created_at);
        CREATE TABLE IF NOT EXISTS memory_sources(
            memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
            message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            PRIMARY KEY(memory_id, message_id)
        ) STRICT;
    )SQL");
    ensureFlexibleMemoryTypes(database_);
}

ContextDatabase::~ContextDatabase() {
    sqlite3_close(database_);
}

void ContextDatabase::appendMessage(
    std::string_view id,
    std::string_view roomId,
    std::string_view personaId,
    std::string_view role,
    std::string_view content,
    std::string_view createdAt) {
    Transaction transaction(database_);
    auto room = prepare(database_, "INSERT INTO rooms(id,persona_id,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET persona_id=excluded.persona_id,updated_at=excluded.updated_at");
    bindText(database_, room.get(), 1, roomId);
    bindText(database_, room.get(), 2, personaId);
    bindText(database_, room.get(), 3, createdAt);
    stepDone(database_, room.get());
    auto message = prepare(database_, "INSERT INTO messages(id,room_id,persona_id,role,content,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET room_id=excluded.room_id,persona_id=excluded.persona_id,role=excluded.role,content=excluded.content,created_at=excluded.created_at");
    bindText(database_, message.get(), 1, id);
    bindText(database_, message.get(), 2, roomId);
    bindText(database_, message.get(), 3, personaId);
    bindText(database_, message.get(), 4, role);
    bindText(database_, message.get(), 5, content);
    bindText(database_, message.get(), 6, createdAt);
    stepDone(database_, message.get());
    transaction.commit();
}

void ContextDatabase::appendMemory(
    std::string_view id,
    std::string_view personaId,
    std::string_view roomId,
    std::string_view type,
    std::string_view text,
    std::string_view createdAt,
    const std::vector<std::string>& sourceMessageIds) {
    Transaction transaction(database_);
    auto memory = prepare(database_, "INSERT OR REPLACE INTO memories(id,persona_id,room_id,memory_type,memory_text,created_at) VALUES(?,?,?,?,?,?)");
    bindText(database_, memory.get(), 1, id);
    bindText(database_, memory.get(), 2, personaId);
    if (roomId.empty()) sqlite3_bind_null(memory.get(), 3); else bindText(database_, memory.get(), 3, roomId);
    bindText(database_, memory.get(), 4, type);
    bindText(database_, memory.get(), 5, text);
    bindText(database_, memory.get(), 6, createdAt);
    stepDone(database_, memory.get());
    for (const std::string& sourceMessageId : sourceMessageIds) {
        if (sourceMessageId.empty()) continue;
        auto source = prepare(database_, "INSERT OR IGNORE INTO memory_sources(memory_id,message_id) VALUES(?,?)");
        bindText(database_, source.get(), 1, id);
        bindText(database_, source.get(), 2, sourceMessageId);
        stepDone(database_, source.get());
    }
    transaction.commit();
}

std::string ContextDatabase::queryContext(
    std::string_view personaId,
    std::string_view roomId,
    int recentLimit,
    int memoryLimit) const {
    recentLimit = std::clamp(recentLimit, 0, 200);
    memoryLimit = std::clamp(memoryLimit, 0, 200);
    std::string output = "{\"messages\":[";
    auto messages = prepare(database_, R"SQL(
        SELECT id,role,content,created_at FROM (
            SELECT id,role,content,created_at FROM messages
            WHERE room_id=? AND persona_id=? ORDER BY created_at DESC LIMIT ?
        ) ORDER BY created_at ASC)SQL");
    bindText(database_, messages.get(), 1, roomId);
    bindText(database_, messages.get(), 2, personaId);
    sqlite3_bind_int(messages.get(), 3, recentLimit);
    bool comma = false;
    int stepResult = SQLITE_ROW;
    while ((stepResult = sqlite3_step(messages.get())) == SQLITE_ROW) {
        if (comma) output.push_back(',');
        output.push_back('{');
        appendJsonString(output, "id", columnText(messages.get(), 0), false);
        appendJsonString(output, "role", columnText(messages.get(), 1), true);
        appendJsonString(output, "content", columnText(messages.get(), 2), true);
        appendJsonString(output, "created_at", columnText(messages.get(), 3), true);
        output.push_back('}');
        comma = true;
    }
    if (stepResult != SQLITE_DONE) {
        fail(database_, "query_messages");
    }
    output += "],\"memories\":[";
    auto memories = prepare(database_, R"SQL(
        SELECT id,memory_type,memory_text,created_at FROM memories
        WHERE persona_id=? ORDER BY created_at DESC LIMIT ?)SQL");
    bindText(database_, memories.get(), 1, personaId);
    sqlite3_bind_int(memories.get(), 2, memoryLimit);
    comma = false;
    stepResult = SQLITE_ROW;
    while ((stepResult = sqlite3_step(memories.get())) == SQLITE_ROW) {
        if (comma) output.push_back(',');
        output.push_back('{');
        appendJsonString(output, "id", columnText(memories.get(), 0), false);
        appendJsonString(output, "memory_type", columnText(memories.get(), 1), true);
        appendJsonString(output, "memory_text", columnText(memories.get(), 2), true);
        appendJsonString(output, "created_at", columnText(memories.get(), 3), true);
        output.push_back('}');
        comma = true;
    }
    if (stepResult != SQLITE_DONE) {
        fail(database_, "query_memories");
    }
    output += "]}";
    return output;
}

std::string ContextDatabase::queryStatistics() const {
    auto scalar = [this](const char* sql) -> std::uint64_t {
        auto statement = prepare(database_, sql);
        if (sqlite3_step(statement.get()) != SQLITE_ROW) fail(database_, "query_statistics");
        return static_cast<std::uint64_t>(sqlite3_column_int64(statement.get(), 0));
    };
    const auto rooms = scalar("SELECT COUNT(*) FROM rooms");
    const auto messages = scalar("SELECT COUNT(*) FROM messages");
    const auto memories = scalar("SELECT COUNT(*) FROM memories");
    const auto contentBytes = scalar("SELECT COALESCE((SELECT SUM(length(CAST(content AS BLOB))) FROM messages),0) + COALESCE((SELECT SUM(length(CAST(memory_text AS BLOB))) FROM memories),0)");
    std::string output = "{\"room_count\":" + std::to_string(rooms)
        + ",\"message_count\":" + std::to_string(messages)
        + ",\"memory_count\":" + std::to_string(memories)
        + ",\"content_bytes\":" + std::to_string(contentBytes)
        + ",\"personas\":[";
    auto statement = prepare(database_, R"SQL(
        SELECT persona_id, SUM(message_count), SUM(memory_count), SUM(content_bytes), MAX(latest_activity_at)
        FROM (
            SELECT persona_id, COUNT(*) AS message_count, 0 AS memory_count,
                   COALESCE(SUM(length(CAST(content AS BLOB))),0) AS content_bytes,
                   MAX(created_at) AS latest_activity_at
            FROM messages GROUP BY persona_id
            UNION ALL
            SELECT persona_id, 0, COUNT(*), COALESCE(SUM(length(CAST(memory_text AS BLOB))),0), MAX(created_at)
            FROM memories GROUP BY persona_id
        ) GROUP BY persona_id ORDER BY content_bytes DESC, persona_id ASC)SQL");
    bool comma = false;
    int stepResult = SQLITE_ROW;
    while ((stepResult = sqlite3_step(statement.get())) == SQLITE_ROW) {
        if (comma) output.push_back(',');
        output += "{\"persona_id\":\"" + jsonEscape(columnText(statement.get(), 0))
            + "\",\"message_count\":" + std::to_string(sqlite3_column_int64(statement.get(), 1))
            + ",\"memory_count\":" + std::to_string(sqlite3_column_int64(statement.get(), 2))
            + ",\"content_bytes\":" + std::to_string(sqlite3_column_int64(statement.get(), 3))
            + ",\"latest_activity_at\":\"" + jsonEscape(columnText(statement.get(), 4)) + "\"}";
        comma = true;
    }
    if (stepResult != SQLITE_DONE) fail(database_, "query_statistics");
    return output + "]}";
}

void ContextDatabase::deleteMessage(std::string_view messageId) {
    Transaction transaction(database_);
    auto digests = prepare(database_, "DELETE FROM memories WHERE memory_type='semantic' AND persona_id=(SELECT persona_id FROM messages WHERE id=?)");
    bindText(database_, digests.get(), 1, messageId);
    stepDone(database_, digests.get());
    auto derived = prepare(database_, "DELETE FROM memories WHERE id IN (SELECT memory_id FROM memory_sources WHERE message_id=?)");
    bindText(database_, derived.get(), 1, messageId);
    stepDone(database_, derived.get());
    auto message = prepare(database_, "DELETE FROM messages WHERE id=?");
    bindText(database_, message.get(), 1, messageId);
    stepDone(database_, message.get());
    transaction.commit();
}

void ContextDatabase::deleteRoom(std::string_view roomId) {
    Transaction transaction(database_);
    auto statement = prepare(database_, "DELETE FROM rooms WHERE id=?");
    bindText(database_, statement.get(), 1, roomId);
    stepDone(database_, statement.get());
    transaction.commit();
}

void ContextDatabase::clearAll() {
    Transaction transaction(database_);
    execute(database_, "DELETE FROM memories; DELETE FROM messages; DELETE FROM rooms;");
    transaction.commit();
}

}
