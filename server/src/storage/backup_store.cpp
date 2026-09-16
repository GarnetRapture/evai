#include "storage/backup_store.hpp"

#include "http/http_response.hpp"
#include "storage/sqlite_database.hpp"

#include <algorithm>
#include <chrono>
#include <exception>
#include <filesystem>
#include <format>
#include <fstream>
#include <optional>
#include <sstream>
#include <string>
#include <string_view>
#include <system_error>

namespace evai::server::storage {

namespace {

constexpr std::string_view backup_file_extension = ".json";

SqliteDatabase& json_parser()
{
    static SqliteDatabase parser(std::filesystem::path(":memory:"));
    return parser;
}

std::optional<std::string> read_json_text(std::string_view body, std::string_view path)
{
    SqliteStatement statement = json_parser().prepare(std::format("SELECT json_extract(?1, '{}')", path));
    statement.bind_text(1, body);
    if (!statement.step() || statement.column_is_null(0)) {
        return std::nullopt;
    }
    return statement.column_text(0);
}

bool is_safe_backup_name(std::string_view name)
{
    if (name.empty() || name.size() > 128 || !name.ends_with(backup_file_extension)) {
        return false;
    }
    return std::ranges::all_of(name, [](char character) {
        return (character >= 'a' && character <= 'z')
            || (character >= 'A' && character <= 'Z')
            || (character >= '0' && character <= '9')
            || character == '-' || character == '_' || character == '.';
    }) && name.find("..") == std::string_view::npos;
}

std::string file_modified_at(const std::filesystem::path& file)
{
    std::error_code error;
    const auto written = std::filesystem::last_write_time(file, error);
    if (error) {
        return {};
    }
    const auto system_time = std::chrono::clock_cast<std::chrono::system_clock>(written);
    return std::format("{:%FT%TZ}", std::chrono::floor<std::chrono::seconds>(system_time));
}

BackupResponse failure(int status_code, std::string_view code, std::string_view detail)
{
    return BackupResponse{status_code, http::json_error_body(code, detail)};
}

}

BackupStore::BackupStore(const std::filesystem::path& directory)
    : directory_(directory)
{
    std::filesystem::create_directories(directory_);
}

const std::filesystem::path& BackupStore::directory() const
{
    return directory_;
}

BackupResponse BackupStore::list_files()
{
    try {
        std::string entries;
        std::error_code error;
        for (const std::filesystem::directory_entry& entry : std::filesystem::directory_iterator(directory_, error)) {
            if (!entry.is_regular_file(error)) {
                continue;
            }
            const std::string name = entry.path().filename().string();
            if (!is_safe_backup_name(name)) {
                continue;
            }
            if (!entries.empty()) {
                entries += ',';
            }
            entries += std::format(
                "{{\"name\":\"{}\",\"size_bytes\":{},\"modified_at\":\"{}\"}}",
                http::json_escaped(name),
                entry.file_size(error),
                http::json_escaped(file_modified_at(entry.path())));
        }
        return BackupResponse{200, std::format("{{\"directory\":\"{}\",\"files\":[{}]}}", http::json_escaped(directory_.string()), entries)};
    }
    catch (const std::exception& error) {
        return failure(500, "backup_error", error.what());
    }
}

BackupResponse BackupStore::read_file(std::string_view request_body)
{
    try {
        const std::optional<std::string> name = read_json_text(request_body, "$.name");
        if (!name.has_value() || !is_safe_backup_name(*name)) {
            return failure(400, "invalid_backup_name", name.value_or(std::string{}));
        }
        std::ifstream stream(directory_ / *name, std::ios::binary);
        if (!stream) {
            return failure(404, "backup_not_found", *name);
        }
        std::ostringstream content;
        content << stream.rdbuf();
        return BackupResponse{200, std::format("{{\"name\":\"{}\",\"content\":{}}}", http::json_escaped(*name), content.str())};
    }
    catch (const std::exception& error) {
        return failure(500, "backup_error", error.what());
    }
}

BackupResponse BackupStore::write_file(std::string_view request_body)
{
    try {
        const std::optional<std::string> name = read_json_text(request_body, "$.name");
        if (!name.has_value() || !is_safe_backup_name(*name)) {
            return failure(400, "invalid_backup_name", name.value_or(std::string{}));
        }
        const std::optional<std::string> content = read_json_text(request_body, "$.content");
        if (!content.has_value()) {
            return failure(400, "invalid_backup_content", *name);
        }
        const std::filesystem::path file = directory_ / *name;
        std::ofstream stream(file, std::ios::binary | std::ios::trunc);
        if (!stream) {
            return failure(500, "backup_error", file.string());
        }
        stream << *content;
        stream.flush();
        if (!stream) {
            return failure(500, "backup_error", file.string());
        }
        return BackupResponse{200, std::format("{{\"name\":\"{}\",\"written\":true}}", http::json_escaped(*name))};
    }
    catch (const std::exception& error) {
        return failure(500, "backup_error", error.what());
    }
}

BackupResponse BackupStore::remove_file(std::string_view request_body)
{
    try {
        const std::optional<std::string> name = read_json_text(request_body, "$.name");
        if (!name.has_value() || !is_safe_backup_name(*name)) {
            return failure(400, "invalid_backup_name", name.value_or(std::string{}));
        }
        std::error_code error;
        const bool removed = std::filesystem::remove(directory_ / *name, error);
        if (error) {
            return failure(500, "backup_error", error.message());
        }
        return BackupResponse{200, std::format("{{\"name\":\"{}\",\"removed\":{}}}", http::json_escaped(*name), removed ? "true" : "false")};
    }
    catch (const std::exception& error) {
        return failure(500, "backup_error", error.what());
    }
}

}
