#pragma once

#include <cstdint>
#include <span>
#include <string>
#include <string_view>

namespace evai::server::app {

enum class ServerRunMode {
    serve,
    create_database,
};

struct ServerOptions {
    std::uint16_t port;
    ServerRunMode run_mode;
    std::string database_path;
};

inline constexpr std::uint16_t default_server_port = 9999;
inline constexpr std::string_view database_directory_name = "evai-database";
inline constexpr std::string_view database_file_name = "evai.sqlite3";

[[nodiscard]] ServerOptions parse_server_options(std::span<const std::string_view> arguments);

}
