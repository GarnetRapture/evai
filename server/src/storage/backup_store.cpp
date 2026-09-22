#include "storage/backup_store.hpp"

#include "http/http_response.hpp"
#include "sqlite3.h"
#include "storage/sqlite_database.hpp"

#include <algorithm>
#include <chrono>
#include <cstddef>
#include <exception>
#include <filesystem>
#include <format>
#include <optional>
#include <string>
#include <string_view>
#include <system_error>
#include <vector>

namespace evai::server::storage
{

namespace
{

constexpr int backup_history_limit = 10;
constexpr int backup_busy_timeout_ms = 5000;

SqliteDatabase &json_parser()
{
    static SqliteDatabase parser(std::filesystem::path(":memory:"));
    return parser;
}

std::optional<std::string> read_json_text(std::string_view body, std::string_view path)
{
    SqliteStatement statement = json_parser().prepare(std::format("SELECT json_extract(?1, '{}')", path));
    statement.bind_text(1, body);
    if (!statement.step() || statement.column_is_null(0))
    {
        return std::nullopt;
    }
    return statement.column_text(0);
}

bool is_safe_backup_name(std::string_view name)
{
    if (name.empty() || name.size() > 128 || !name.ends_with(backup_file_extension))
    {
        return false;
    }
    if (!name.starts_with(backup_file_name_prefix))
    {
        return false;
    }
    return std::ranges::all_of(name,
                               [](char character) {
                                   return (character >= 'a' && character <= 'z') ||
                                          (character >= 'A' && character <= 'Z') ||
                                          (character >= '0' && character <= '9') || character == '-' ||
                                          character == '_' || character == '.';
                               }) &&
           name.find("..") == std::string_view::npos;
}

bool is_history_backup_name(std::string_view name)
{
    return is_safe_backup_name(name) && name != backup_latest_file_name;
}

std::string file_modified_at(const std::filesystem::path &file)
{
    std::error_code error;
    const auto written = std::filesystem::last_write_time(file, error);
    if (error)
    {
        return {};
    }
    const auto system_time = std::chrono::clock_cast<std::chrono::system_clock>(written);
    return std::format("{:%FT%TZ}", std::chrono::floor<std::chrono::seconds>(system_time));
}

std::string backup_timestamp()
{
    const auto now = std::chrono::floor<std::chrono::seconds>(std::chrono::system_clock::now());
    return std::format("{:%Y-%m-%dT%H-%M-%SZ}", now);
}

BackupResponse failure(int status_code, std::string_view code, std::string_view detail)
{
    return BackupResponse{status_code, http::json_error_body(code, detail)};
}

bool copy_database_file(const std::filesystem::path &source, const std::filesystem::path &target)
{
    sqlite3 *source_connection = nullptr;
    const std::string source_path = source.string();
    if (sqlite3_open_v2(source_path.c_str(), &source_connection, SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX,
                        nullptr) != SQLITE_OK)
    {
        sqlite3_close_v2(source_connection);
        return false;
    }
    sqlite3_busy_timeout(source_connection, backup_busy_timeout_ms);
    sqlite3 *target_connection = nullptr;
    const std::string target_path = target.string();
    if (sqlite3_open_v2(target_path.c_str(), &target_connection,
                        SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nullptr) != SQLITE_OK)
    {
        sqlite3_close_v2(target_connection);
        sqlite3_close_v2(source_connection);
        return false;
    }
    sqlite3_busy_timeout(target_connection, backup_busy_timeout_ms);
    sqlite3_backup *copy = sqlite3_backup_init(target_connection, "main", source_connection, "main");
    bool completed = false;
    if (copy != nullptr)
    {
        const int status = sqlite3_backup_step(copy, -1);
        completed = sqlite3_backup_finish(copy) == SQLITE_OK && status == SQLITE_DONE;
    }
    sqlite3_close_v2(target_connection);
    sqlite3_close_v2(source_connection);
    return completed;
}

} // namespace

BackupStore::BackupStore(const std::filesystem::path &directory, const std::filesystem::path &database_file)
    : directory_(directory), database_file_(database_file)
{
    std::filesystem::create_directories(directory_);
}

const std::filesystem::path &BackupStore::directory() const
{
    return directory_;
}

std::filesystem::path BackupStore::backup_path_for(std::string_view name) const
{
    return directory_ / std::string(name);
}

BackupResponse BackupStore::list_files()
{
    try
    {
        std::string entries;
        std::error_code error;
        for (const std::filesystem::directory_entry &entry : std::filesystem::directory_iterator(directory_, error))
        {
            if (!entry.is_regular_file(error))
            {
                continue;
            }
            const std::string name = entry.path().filename().string();
            if (!is_safe_backup_name(name))
            {
                continue;
            }
            if (!entries.empty())
            {
                entries += ',';
            }
            entries +=
                std::format("{{\"name\":\"{}\",\"size_bytes\":{},\"modified_at\":\"{}\"}}", http::json_escaped(name),
                            entry.file_size(error), http::json_escaped(file_modified_at(entry.path())));
        }
        return BackupResponse{200, std::format("{{\"directory\":\"{}\",\"files\":[{}]}}",
                                               http::json_escaped(directory_.string()), entries)};
    }
    catch (const std::exception &error)
    {
        return failure(500, "backup_error", error.what());
    }
}

BackupResponse BackupStore::create_backup()
{
    try
    {
        if (!std::filesystem::is_regular_file(database_file_))
        {
            return failure(404, "backup_database_missing", database_file_.string());
        }
        const std::string name =
            std::format("{}{}{}", backup_file_name_prefix, backup_timestamp(), backup_file_extension);
        const std::filesystem::path target = backup_path_for(name);
        std::error_code error;
        std::filesystem::remove(target, error);
        if (!copy_database_file(database_file_, target))
        {
            return failure(500, "backup_copy_failed", target.string());
        }
        const std::filesystem::path latest = backup_path_for(backup_latest_file_name);
        std::filesystem::remove(latest, error);
        if (!copy_database_file(target, latest))
        {
            return failure(500, "backup_copy_failed", latest.string());
        }
        std::vector<std::filesystem::path> history;
        for (const std::filesystem::directory_entry &entry : std::filesystem::directory_iterator(directory_, error))
        {
            if (entry.is_regular_file(error) && is_history_backup_name(entry.path().filename().string()))
            {
                history.push_back(entry.path());
            }
        }
        std::ranges::sort(history, [](const std::filesystem::path &left, const std::filesystem::path &right) {
            return left.filename().string() < right.filename().string();
        });
        if (history.size() > static_cast<std::size_t>(backup_history_limit))
        {
            for (std::size_t index = 0; index < history.size() - static_cast<std::size_t>(backup_history_limit);
                 index += 1)
            {
                std::filesystem::remove(history[index], error);
            }
        }
        return BackupResponse{200, std::format("{{\"name\":\"{}\",\"created\":true,\"size_bytes\":{}}}",
                                               http::json_escaped(name), std::filesystem::file_size(target, error))};
    }
    catch (const std::exception &error)
    {
        return failure(500, "backup_error", error.what());
    }
}

BackupResponse BackupStore::restore_backup(std::string_view request_body)
{
    try
    {
        const std::optional<std::string> name = read_json_text(request_body, "$.name");
        if (!name.has_value() || !is_safe_backup_name(*name))
        {
            return failure(400, "invalid_backup_name", name.value_or(std::string{}));
        }
        const std::filesystem::path source = backup_path_for(*name);
        if (!std::filesystem::is_regular_file(source))
        {
            return failure(404, "backup_not_found", *name);
        }
        if (!copy_database_file(source, database_file_))
        {
            return failure(500, "backup_restore_failed", database_file_.string());
        }
        return BackupResponse{200, std::format("{{\"name\":\"{}\",\"restored\":true}}", http::json_escaped(*name))};
    }
    catch (const std::exception &error)
    {
        return failure(500, "backup_error", error.what());
    }
}

BackupResponse BackupStore::remove_file(std::string_view request_body)
{
    try
    {
        const std::optional<std::string> name = read_json_text(request_body, "$.name");
        if (!name.has_value() || !is_safe_backup_name(*name))
        {
            return failure(400, "invalid_backup_name", name.value_or(std::string{}));
        }
        std::error_code error;
        const bool removed = std::filesystem::remove(directory_ / *name, error);
        if (error)
        {
            return failure(500, "backup_error", error.message());
        }
        return BackupResponse{200, std::format("{{\"name\":\"{}\",\"removed\":{}}}", http::json_escaped(*name),
                                               removed ? "true" : "false")};
    }
    catch (const std::exception &error)
    {
        return failure(500, "backup_error", error.what());
    }
}

} // namespace evai::server::storage
