#pragma once

#include "storage/sqlite_database.hpp"

#include <condition_variable>
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

class ReaderPool {
public:
    ReaderPool(const std::filesystem::path& file, std::size_t count);
    ReaderPool(const ReaderPool&) = delete;
    ReaderPool& operator=(const ReaderPool&) = delete;
    ReaderPool(ReaderPool&&) = delete;
    ReaderPool& operator=(ReaderPool&&) = delete;

    [[nodiscard]] DatabaseConnection& take();
    void give_back(DatabaseConnection& connection);
    [[nodiscard]] std::vector<std::unique_lock<std::mutex>> lock_all();

private:
    std::vector<std::unique_ptr<DatabaseConnection>> connections_;
    std::vector<DatabaseConnection*> idle_;
    std::mutex mutex_;
    std::condition_variable released_;
};

class ReaderLease {
public:
    explicit ReaderLease(ReaderPool& pool);
    ~ReaderLease();
    ReaderLease(const ReaderLease&) = delete;
    ReaderLease& operator=(const ReaderLease&) = delete;
    ReaderLease(ReaderLease&&) = delete;
    ReaderLease& operator=(ReaderLease&&) = delete;

    [[nodiscard]] DatabaseConnection& connection() const;

private:
    ReaderPool* pool_;
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
    DatabaseConnection writer_;
    ReaderPool readers_;
};

void apply_evai_schema(SqliteDatabase& database);
void create_evai_database(const std::filesystem::path& file);

}
