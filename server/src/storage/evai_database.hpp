#pragma once

#include "storage/sqlite_database.hpp"

#include <cstdint>
#include <filesystem>
#include <mutex>
#include <optional>
#include <string>
#include <string_view>

namespace evai::server::storage {

struct StorageResponse {
    int status_code;
    std::string body;
};

struct DatabaseSummary {
    std::string schema_version;
    std::int64_t record_count;
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
    [[nodiscard]] const std::filesystem::path& file() const;

private:
    SqliteDatabase database_;
    std::mutex mutex_;
};

void apply_evai_schema(SqliteDatabase& database);
void create_evai_database(const std::filesystem::path& file);

}
