#pragma once

#include <filesystem>
#include <string>
#include <string_view>

namespace evai::server::storage
{

struct BackupResponse
{
    int status_code;
    std::string body;
};

inline constexpr std::string_view backup_directory_name = "evai-backup";
inline constexpr std::string_view backup_file_name_prefix = "evai-backup-";
inline constexpr std::string_view backup_latest_file_name = "evai-backup-latest.sqlite3";
inline constexpr std::string_view backup_file_extension = ".sqlite3";

class BackupStore
{
  public:
    BackupStore(const std::filesystem::path &directory, const std::filesystem::path &database_file);

    [[nodiscard]] BackupResponse list_files();
    [[nodiscard]] BackupResponse create_backup();
    [[nodiscard]] BackupResponse restore_backup(std::string_view request_body);
    [[nodiscard]] BackupResponse remove_file(std::string_view request_body);
    [[nodiscard]] const std::filesystem::path &directory() const;

  private:
    [[nodiscard]] std::filesystem::path backup_path_for(std::string_view name) const;

    std::filesystem::path directory_;
    std::filesystem::path database_file_;
};

} // namespace evai::server::storage
