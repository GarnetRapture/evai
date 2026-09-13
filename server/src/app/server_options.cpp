#include "app/server_options.hpp"

#include <charconv>
#include <cstddef>
#include <cstdint>
#include <format>
#include <span>
#include <stdexcept>
#include <string>
#include <string_view>
#include <system_error>

namespace evai::server::app {

namespace {

constexpr std::string_view port_option = "--port";

std::uint16_t parse_port(std::string_view value)
{
    unsigned int port = 0;
    const auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), port);
    if (error != std::errc{} || end != value.data() + value.size() || port == 0 || port > 65535) {
        throw std::invalid_argument(std::format("invalid port: {}", value));
    }
    return static_cast<std::uint16_t>(port);
}

}

ServerOptions parse_server_options(std::span<const std::string_view> arguments)
{
    ServerOptions options{default_server_port};
    for (std::size_t index = 0; index < arguments.size(); ++index) {
        if (arguments[index] != port_option) {
            throw std::invalid_argument(std::format("unknown argument: {}", arguments[index]));
        }
        if (index + 1 >= arguments.size()) {
            throw std::invalid_argument(std::format("{} requires a value", port_option));
        }
        options.port = parse_port(arguments[++index]);
    }
    return options;
}

}
