#pragma once

#include "net/tcp_socket.hpp"

#include <array>
#include <cstdint>
#include <filesystem>
#include <string>

namespace evai::server::site {

struct StaticSiteContext {
    std::filesystem::path root_directory;
    std::array<std::string, 2> allowed_hosts;
};

[[nodiscard]] StaticSiteContext create_static_site_context(const std::filesystem::path& root_directory, std::uint16_t port);

void serve_static_site_connection(net::TcpSocket client, const StaticSiteContext& context);

}
