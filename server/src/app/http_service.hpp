#pragma once

#include "net/tcp_socket.hpp"
#include "site/static_site.hpp"
#include "storage/backup_store.hpp"
#include "storage/evai_database.hpp"

#include <cstdint>
#include <filesystem>
#include <string>
#include <vector>

namespace evai::server::app {

struct HttpServiceContext {
    site::StaticSiteContext site;
    storage::EvaiDatabase* database;
    storage::BackupStore* backups;
    std::vector<std::string> allowed_hosts;
    std::vector<std::string> allowed_origins;
    std::uint16_t port;
    std::filesystem::path config_file;
};

[[nodiscard]] HttpServiceContext create_http_service_context(
    const std::filesystem::path& root_directory,
    const std::filesystem::path& database_directory,
    storage::EvaiDatabase& database,
    storage::BackupStore& backups,
    std::uint16_t port,
    const std::filesystem::path& config_file);

void serve_http_connection(net::TcpSocket client, const HttpServiceContext& context);

}
