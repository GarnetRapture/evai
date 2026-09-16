#pragma once

#include <filesystem>
#include <string>
#include <string_view>

namespace evai::server::storage {

struct BackupResponse {
    int status_code;
    std::string body;
};

inline constexpr std::string_view backup_directory_name = "evai-backup";

class BackupStore {
public:
    explicit BackupStore(const std::filesystem::path& directory);

    [[nodiscard]] BackupResponse list_files();
    [[nodiscard]] BackupResponse read_file(std::string_view request_body);
    [[nodiscard]] BackupResponse write_file(std::string_view request_body);
    [[nodiscard]] BackupResponse remove_file(std::string_view request_body);
    [[nodiscard]] const std::filesystem::path& directory() const;

private:
    std::filesystem::path directory_;
};

}
