#pragma once

#include <cstdint>
#include <filesystem>
#include <string>

namespace evai::server::app {

enum class ConsoleLanguage {
    korean,
    english,
    chinese,
};

struct ServerConfig {
    ConsoleLanguage language;
    bool language_configured;
    std::string ollama_base_url;
};

inline constexpr std::string_view config_file_name = "evai-server.ini";
inline constexpr std::string_view default_ollama_base_url = "http://127.0.0.1:11434";

[[nodiscard]] ServerConfig read_server_config(const std::filesystem::path& file);
void write_server_config(const std::filesystem::path& file, const ServerConfig& config);
[[nodiscard]] std::string_view language_code(ConsoleLanguage language);

}
