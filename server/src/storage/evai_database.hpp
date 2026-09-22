#pragma once

#include "storage/sqlite_database.hpp"

#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

namespace evai::server::storage {

struct StorageResponse {
    int status_code;
    std::string body;
};

struct DatabaseSummary {
    std::int64_t record_count;
};

struct StatementCacheHash {
    using is_transparent = void;

    [[nodiscard]] std::size_t operator()(std::string_view key) const noexcept;
};

class DatabaseConnection {
public:
    explicit DatabaseConnection(const std::filesystem::path& file);
    DatabaseConnection(const DatabaseConnection&) = delete;
    DatabaseConnection& operator=(const DatabaseConnection&) = delete;
    DatabaseConnection(DatabaseConnection&&) = delete;
    DatabaseConnection& operator=(DatabaseConnection&&) = delete;

    [[nodiscard]] SqliteDatabase& database();
    [[nodiscard]] const std::filesystem::path& file() const;
    [[nodiscard]] SqliteStatement& cached(std::string_view key, std::string_view sql);
    [[nodiscard]] std::mutex& mutex();
    void clear_cache();

private:
    SqliteDatabase database_;
    std::unordered_map<std::string, SqliteStatement, StatementCacheHash, std::equal_to<>> statements_;
    std::mutex mutex_;
};

class ReaderLease {
public:
    ReaderLease(DatabaseConnection& connection, std::unique_lock<std::mutex> lock);

    [[nodiscard]] DatabaseConnection& connection() const;

private:
    DatabaseConnection* connection_;
    std::unique_lock<std::mutex> lock_;
};

class MaintenanceLease {
public:
    MaintenanceLease(std::unique_lock<std::mutex> writer_lock, std::vector<std::unique_lock<std::mutex>> reader_locks);

private:
    std::unique_lock<std::mutex> writer_lock_;
    std::vector<std::unique_lock<std::mutex>> reader_locks_;
};

class EvaiDatabase {
public:
    explicit EvaiDatabase(const std::filesystem::path& file);

    [[nodiscard]] DatabaseSummary read_summary();
    [[nodiscard]] std::optional<std::string> read_ollama_base_url();

    [[nodiscard]] StorageResponse read_document(std::string_view request_body);
    [[nodiscard]] StorageResponse query_entries(std::string_view request_body);
    [[nodiscard]] StorageResponse count_entries(std::string_view request_body);
    [[nodiscard]] StorageResponse commit_writes(std::string_view request_body);
    [[nodiscard]] StorageResponse restore_snapshot(std::string_view request_body);
    [[nodiscard]] StorageResponse reset_storage();
    [[nodiscard]] StorageResponse read_status();
    [[nodiscard]] StorageResponse read_schema();
    [[nodiscard]] MaintenanceLease lock_for_maintenance();
    [[nodiscard]] const std::filesystem::path& file() const;

private:
    [[nodiscard]] ReaderLease acquire_reader();

    DatabaseConnection writer_;
    std::vector<std::unique_ptr<DatabaseConnection>> readers_;
};

void apply_evai_schema(SqliteDatabase& database);
void create_evai_database(const std::filesystem::path& file);

}
