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
constexpr std::string_view create_database_option = "--create-database";

std::uint16_t parse_port(std::string_view value)
{
    unsigned int port = 0;
    const auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), port);
    if (error != std::errc{} || end != value.data() + value.size() || port == 0 || port > 65535) {
        throw std::invalid_argument(std::format("invalid port: {}", value));
    }
    return static_cast<std::uint16_t>(port);
}

std::string_view require_value(std::span<const std::string_view> arguments, std::size_t& index, std::string_view option)
{
    if (index + 1 >= arguments.size()) {
        throw std::invalid_argument(std::format("{} requires a value", option));
    }
    return arguments[++index];
}

}

ServerOptions parse_server_options(std::span<const std::string_view> arguments)
{
    ServerOptions options{default_server_port, ServerRunMode::serve, std::string{}};
    for (std::size_t index = 0; index < arguments.size(); ++index) {
        if (arguments[index] == port_option) {
            options.port = parse_port(require_value(arguments, index, port_option));
            continue;
        }
        if (arguments[index] == create_database_option) {
            options.run_mode = ServerRunMode::create_database;
            options.database_path = std::string(require_value(arguments, index, create_database_option));
            continue;
        }
        throw std::invalid_argument(std::format("unknown argument: {}", arguments[index]));
    }
    return options;
}

}
