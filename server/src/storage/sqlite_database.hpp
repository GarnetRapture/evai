#pragma once

#include "sqlite3.h"

#include <cstdint>
#include <filesystem>
#include <string>
#include <string_view>

namespace evai::server::storage {

class SqliteStatement {
public:
    SqliteStatement(sqlite3* connection, std::string_view sql);
    ~SqliteStatement();
    SqliteStatement(const SqliteStatement&) = delete;
    SqliteStatement& operator=(const SqliteStatement&) = delete;
    SqliteStatement(SqliteStatement&& other) noexcept;
    SqliteStatement& operator=(SqliteStatement&& other) noexcept;

    void bind_text(int index, std::string_view value);
    void bind_null(int index);
    [[nodiscard]] bool step();
    void run();
    void reset();
    [[nodiscard]] bool column_is_null(int index) const;
    [[nodiscard]] std::string column_text(int index) const;
    [[nodiscard]] std::int64_t column_integer(int index) const;

private:
    void finalize();

    sqlite3* connection_ = nullptr;
    sqlite3_stmt* statement_ = nullptr;
    std::string sql_;
};

class SqliteDatabase {
public:
    explicit SqliteDatabase(const std::filesystem::path& file);
    ~SqliteDatabase();
    SqliteDatabase(const SqliteDatabase&) = delete;
    SqliteDatabase& operator=(const SqliteDatabase&) = delete;
    SqliteDatabase(SqliteDatabase&&) = delete;
    SqliteDatabase& operator=(SqliteDatabase&&) = delete;

    void execute(std::string_view sql);
    [[nodiscard]] SqliteStatement prepare(std::string_view sql);
    [[nodiscard]] std::int64_t changes() const;
    [[nodiscard]] const std::filesystem::path& file() const;

private:
    std::filesystem::path file_;
    sqlite3* connection_ = nullptr;
};

[[nodiscard]] std::string_view sqlite_library_version();

}
