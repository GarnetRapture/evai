#include "storage/sqlite_database.hpp"

#include "sqlite3.h"

#include <cstdint>
#include <filesystem>
#include <format>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

namespace evai::server::storage {

namespace {

[[noreturn]] void throw_sqlite_error(sqlite3* connection, std::string_view context)
{
    const char* message = connection == nullptr ? "sqlite connection is closed" : sqlite3_errmsg(connection);
    throw std::runtime_error(std::format("{}: {}", context, message == nullptr ? "unknown error" : message));
}

}

SqliteStatement::SqliteStatement(sqlite3* connection, std::string_view sql)
    : connection_(connection)
    , sql_(sql)
{
    if (sqlite3_prepare_v2(connection_, sql.data(), static_cast<int>(sql.size()), &statement_, nullptr) != SQLITE_OK) {
        throw_sqlite_error(connection_, std::format("prepare failed for {}", sql));
    }
}

SqliteStatement::~SqliteStatement()
{
    finalize();
}

SqliteStatement::SqliteStatement(SqliteStatement&& other) noexcept
    : connection_(std::exchange(other.connection_, nullptr))
    , statement_(std::exchange(other.statement_, nullptr))
    , sql_(std::exchange(other.sql_, std::string{}))
{
}

SqliteStatement& SqliteStatement::operator=(SqliteStatement&& other) noexcept
{
    if (this != &other) {
        finalize();
        connection_ = std::exchange(other.connection_, nullptr);
        statement_ = std::exchange(other.statement_, nullptr);
        sql_ = std::exchange(other.sql_, std::string{});
    }
    return *this;
}

void SqliteStatement::bind_text(int index, std::string_view value)
{
    if (sqlite3_bind_text(statement_, index, value.data(), static_cast<int>(value.size()), SQLITE_TRANSIENT) != SQLITE_OK) {
        throw_sqlite_error(connection_, std::format("bind failed for {}", sql_));
    }
}

void SqliteStatement::bind_null(int index)
{
    if (sqlite3_bind_null(statement_, index) != SQLITE_OK) {
        throw_sqlite_error(connection_, std::format("bind failed for {}", sql_));
    }
}

bool SqliteStatement::step()
{
    const int status = sqlite3_step(statement_);
    if (status == SQLITE_ROW) {
        return true;
    }
    if (status == SQLITE_DONE) {
        return false;
    }
    throw_sqlite_error(connection_, std::format("step failed for {}", sql_));
}

void SqliteStatement::run()
{
    while (step()) {
    }
}

void SqliteStatement::reset()
{
    sqlite3_reset(statement_);
    sqlite3_clear_bindings(statement_);
}

bool SqliteStatement::column_is_null(int index) const
{
    return sqlite3_column_type(statement_, index) == SQLITE_NULL;
}

std::string SqliteStatement::column_text(int index) const
{
    const unsigned char* text = sqlite3_column_text(statement_, index);
    if (text == nullptr) {
        return {};
    }
    return std::string(reinterpret_cast<const char*>(text), static_cast<std::size_t>(sqlite3_column_bytes(statement_, index)));
}

std::int64_t SqliteStatement::column_integer(int index) const
{
    return sqlite3_column_int64(statement_, index);
}

void SqliteStatement::finalize()
{
    if (statement_ != nullptr) {
        sqlite3_finalize(std::exchange(statement_, nullptr));
    }
    connection_ = nullptr;
}

SqliteDatabase::SqliteDatabase(const std::filesystem::path& file)
    : file_(file)
{
    const std::string path = file.string();
    if (sqlite3_open_v2(path.c_str(), &connection_, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nullptr) != SQLITE_OK) {
        const std::string message = connection_ == nullptr ? std::string("out of memory") : std::string(sqlite3_errmsg(connection_));
        sqlite3_close_v2(connection_);
        connection_ = nullptr;
        throw std::runtime_error(std::format("cannot open database {}: {}", path, message));
    }
    sqlite3_busy_timeout(connection_, 5000);
    execute("PRAGMA journal_mode = WAL");
    execute("PRAGMA synchronous = NORMAL");
    execute("PRAGMA foreign_keys = ON");
    execute("PRAGMA temp_store = MEMORY");
}

SqliteDatabase::~SqliteDatabase()
{
    if (connection_ != nullptr) {
        sqlite3_close_v2(std::exchange(connection_, nullptr));
    }
}

void SqliteDatabase::execute(std::string_view sql)
{
    const std::string statement_text(sql);
    char* message = nullptr;
    if (sqlite3_exec(connection_, statement_text.c_str(), nullptr, nullptr, &message) != SQLITE_OK) {
        const std::string detail = message == nullptr ? std::string("unknown error") : std::string(message);
        sqlite3_free(message);
        throw std::runtime_error(std::format("execute failed: {}", detail));
    }
}

SqliteStatement SqliteDatabase::prepare(std::string_view sql)
{
    return SqliteStatement(connection_, sql);
}

std::int64_t SqliteDatabase::changes() const
{
    return sqlite3_changes64(connection_);
}

const std::filesystem::path& SqliteDatabase::file() const
{
    return file_;
}

std::string_view sqlite_library_version()
{
    return sqlite3_libversion();
}

}
