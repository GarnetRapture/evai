#pragma once

#include <cstdint>
#include <span>
#include <string_view>

namespace evai::server::app {

struct ServerOptions {
    std::uint16_t port;
};

inline constexpr std::uint16_t default_server_port = 47831;

[[nodiscard]] ServerOptions parse_server_options(std::span<const std::string_view> arguments);

}
