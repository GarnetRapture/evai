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

enum class VoiceLanguage {
    korean,
    japanese,
    both,
    none,
};

struct ServerConfig {
    ConsoleLanguage language;
    bool language_configured;
    VoiceLanguage voice;
    bool voice_configured;
    bool bgm;
    bool bgm_configured;
};

inline constexpr std::string_view config_file_name = "evai-server.ini";

[[nodiscard]] ServerConfig read_server_config(const std::filesystem::path& file);
void write_server_config(const std::filesystem::path& file, const ServerConfig& config);
[[nodiscard]] std::string_view language_code(ConsoleLanguage language);
[[nodiscard]] std::string_view voice_code(VoiceLanguage voice);

}
