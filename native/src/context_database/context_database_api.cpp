#include "context_database/context_database_api.h"

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <exception>
#include <filesystem>
#include <initializer_list>
#include <new>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

#include <sqlite3.h>

#include "context_database/context_database.h"

struct EverSoulContextDatabase {
    explicit EverSoulContextDatabase(const std::filesystem::path& path) : database(path) {}

    eversoul::native::ContextDatabase database;
};

namespace {

constexpr std::string_view kUnknownFailure = "context_database_unknown_failure";
constexpr std::string_view kInvalidArgument = "context_database_invalid_argument";

std::string_view textView(EverSoulTextView view) noexcept {
    return view.data == nullptr ? std::string_view{} : std::string_view(view.data, view.size);
}

void assignText(EverSoulTextBuffer* output, std::string_view text) noexcept {
    if (output == nullptr) return;
    output->data = nullptr;
    output->size = 0;
    char* data = new (std::nothrow) char[text.size() + 1];
    if (data == nullptr) return;
    if (!text.empty()) std::memcpy(data, text.data(), text.size());
    data[text.size()] = '\0';
    output->data = data;
    output->size = text.size();
}

bool validText(EverSoulTextView view) noexcept {
    return view.data != nullptr || view.size == 0;
}

template <typename Operation>
EverSoulContextDatabaseStatus guarded(EverSoulTextBuffer* output, Operation&& operation) noexcept {
    if (output != nullptr) {
        output->data = nullptr;
        output->size = 0;
    }
    try {
        operation();
        return EVERSOUL_CONTEXT_DATABASE_OK;
    }
    catch (const std::exception& error) {
        assignText(output, error.what());
    }
    catch (...) {
        assignText(output, kUnknownFailure);
    }
    return EVERSOUL_CONTEXT_DATABASE_FAILED;
}

void requireDatabase(const EverSoulContextDatabase* database) {
    if (database == nullptr) throw std::invalid_argument(std::string(kInvalidArgument));
}

void requireText(std::initializer_list<EverSoulTextView> views) {
    for (const EverSoulTextView& view : views) {
        if (!validText(view)) throw std::invalid_argument(std::string(kInvalidArgument));
    }
}

}

EverSoulContextDatabaseStatus eversoul_context_database_open(
    EverSoulTextView utf8Path,
    EverSoulContextDatabase** database,
    EverSoulTextBuffer* output) {
    return guarded(output, [&] {
        if (database == nullptr) throw std::invalid_argument(std::string(kInvalidArgument));
        *database = nullptr;
        requireText({utf8Path});
        const std::string_view path = textView(utf8Path);
        *database = new EverSoulContextDatabase(std::filesystem::path(std::u8string(
            reinterpret_cast<const char8_t*>(path.data()),
            reinterpret_cast<const char8_t*>(path.data() + path.size()))));
    });
}

void eversoul_context_database_close(EverSoulContextDatabase* database) {
    delete database;
}

EverSoulContextDatabaseStatus eversoul_context_database_append_message(
    EverSoulContextDatabase* database,
    EverSoulTextView id,
    EverSoulTextView roomId,
    EverSoulTextView personaId,
    EverSoulTextView role,
    EverSoulTextView content,
    EverSoulTextView createdAt,
    EverSoulTextBuffer* output) {
    return guarded(output, [&] {
        requireDatabase(database);
        requireText({id, roomId, personaId, role, content, createdAt});
        database->database.appendMessage(
            textView(id), textView(roomId), textView(personaId),
            textView(role), textView(content), textView(createdAt));
    });
}

EverSoulContextDatabaseStatus eversoul_context_database_append_memory(
    EverSoulContextDatabase* database,
    EverSoulTextView id,
    EverSoulTextView personaId,
    EverSoulTextView roomId,
    EverSoulTextView memoryType,
    EverSoulTextView memoryText,
    EverSoulTextView createdAt,
    const EverSoulTextView* sourceMessageIds,
    size_t sourceMessageIdCount,
    EverSoulTextBuffer* output) {
    return guarded(output, [&] {
        requireDatabase(database);
        requireText({id, personaId, roomId, memoryType, memoryText, createdAt});
        if (sourceMessageIds == nullptr && sourceMessageIdCount != 0) {
            throw std::invalid_argument(std::string(kInvalidArgument));
        }
        std::vector<std::string> sources;
        sources.reserve(sourceMessageIdCount);
        for (size_t index = 0; index < sourceMessageIdCount; ++index) {
            requireText({sourceMessageIds[index]});
            sources.emplace_back(textView(sourceMessageIds[index]));
        }
        database->database.appendMemory(
            textView(id), textView(personaId), textView(roomId),
            textView(memoryType), textView(memoryText), textView(createdAt), sources);
    });
}

EverSoulContextDatabaseStatus eversoul_context_database_query_context(
    EverSoulContextDatabase* database,
    EverSoulTextView personaId,
    EverSoulTextView roomId,
    int32_t recentLimit,
    int32_t memoryLimit,
    EverSoulTextBuffer* output) {
    return guarded(output, [&] {
        requireDatabase(database);
        requireText({personaId, roomId});
        if (output == nullptr) throw std::invalid_argument(std::string(kInvalidArgument));
        const std::string context = database->database.queryContext(
            textView(personaId), textView(roomId), recentLimit, memoryLimit);
        assignText(output, context);
        if (output->data == nullptr) throw std::bad_alloc();
    });
}

EverSoulContextDatabaseStatus eversoul_context_database_query_statistics(
    EverSoulContextDatabase* database,
    EverSoulTextBuffer* output) {
    return guarded(output, [&] {
        requireDatabase(database);
        if (output == nullptr) throw std::invalid_argument(std::string(kInvalidArgument));
        const std::string statistics = database->database.queryStatistics();
        assignText(output, statistics);
        if (output->data == nullptr) throw std::bad_alloc();
    });
}

EverSoulContextDatabaseStatus eversoul_context_database_delete_message(
    EverSoulContextDatabase* database,
    EverSoulTextView messageId,
    EverSoulTextBuffer* output) {
    return guarded(output, [&] {
        requireDatabase(database);
        requireText({messageId});
        database->database.deleteMessage(textView(messageId));
    });
}

EverSoulContextDatabaseStatus eversoul_context_database_delete_room(
    EverSoulContextDatabase* database,
    EverSoulTextView roomId,
    EverSoulTextBuffer* output) {
    return guarded(output, [&] {
        requireDatabase(database);
        requireText({roomId});
        database->database.deleteRoom(textView(roomId));
    });
}

EverSoulContextDatabaseStatus eversoul_context_database_clear_all(
    EverSoulContextDatabase* database,
    EverSoulTextBuffer* output) {
    return guarded(output, [&] {
        requireDatabase(database);
        database->database.clearAll();
    });
}

EverSoulTextView eversoul_context_database_engine_version(void) {
    const char* version = sqlite3_libversion();
    return EverSoulTextView{version, std::strlen(version)};
}

void eversoul_context_database_release_text(EverSoulTextBuffer* buffer) {
    if (buffer == nullptr) return;
    delete[] buffer->data;
    buffer->data = nullptr;
    buffer->size = 0;
}
