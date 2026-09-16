#include "app/server_config.hpp"

#include <filesystem>
#include <fstream>
#include <string>
#include <string_view>

namespace evai::server::app {

namespace {

constexpr std::string_view language_key = "language";

std::string trim(std::string_view value)
{
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string_view::npos) {
        return {};
    }
    const auto last = value.find_last_not_of(" \t\r\n");
    return std::string(value.substr(first, last - first + 1));
}

ConsoleLanguage parse_language(std::string_view value, bool& configured)
{
    configured = true;
    if (value == "en") {
        return ConsoleLanguage::english;
    }
    if (value == "zh") {
        return ConsoleLanguage::chinese;
    }
    if (value == "ko") {
        return ConsoleLanguage::korean;
    }
    configured = false;
    return ConsoleLanguage::korean;
}

}

std::string_view language_code(ConsoleLanguage language)
{
    switch (language) {
        case ConsoleLanguage::english:
            return "en";
        case ConsoleLanguage::chinese:
            return "zh";
        case ConsoleLanguage::korean:
            break;
    }
    return "ko";
}

ServerConfig read_server_config(const std::filesystem::path& file)
{
    ServerConfig config{ConsoleLanguage::korean, false};
    std::ifstream stream(file);
    if (!stream) {
        return config;
    }
    std::string line;
    while (std::getline(stream, line)) {
        const auto separator = line.find('=');
        if (separator == std::string::npos || line.starts_with('#') || line.starts_with(';') || line.starts_with('[')) {
            continue;
        }
        const std::string key = trim(std::string_view(line).substr(0, separator));
        const std::string value = trim(std::string_view(line).substr(separator + 1));
        if (key == language_key) {
            config.language = parse_language(value, config.language_configured);
        }
    }
    return config;
}

void write_server_config(const std::filesystem::path& file, const ServerConfig& config)
{
    std::ofstream stream(file, std::ios::trunc);
    if (!stream) {
        return;
    }
    stream << "[evai-server]\n"
           << language_key << " = " << language_code(config.language) << '\n';
}

}
