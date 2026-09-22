#pragma once

#include "app/server_config.hpp"

#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <string>
#include <string_view>

namespace evai::server::app {

struct ServerStatusReport {
    std::filesystem::path root_directory;
    std::filesystem::path database_file;
    std::int64_t database_record_count;
    std::string ollama_base_url;
    bool ollama_available;
    std::string ollama_detail;
    std::uint16_t port;
};

struct AssetStatusReport {
    std::size_t present;
    std::size_t relocated;
    std::size_t downloaded;
    std::size_t failed;
    std::uint64_t bytes;
    std::string detail;
};

void prepare_console();
void print_banner();
[[nodiscard]] ConsoleLanguage choose_console_language();
[[nodiscard]] VoiceLanguage choose_voice_language(ConsoleLanguage language);
void print_asset_check(ConsoleLanguage language);
void print_asset_progress(ConsoleLanguage language, std::size_t completed, std::size_t total, std::uint64_t bytes,
                          std::uint64_t total_bytes);
void print_asset_summary(ConsoleLanguage language, const AssetStatusReport& report);
void print_status_report(ConsoleLanguage language, const ServerStatusReport& report);
void print_startup_failure(ConsoleLanguage language, std::string_view detail);
void print_config_location(ConsoleLanguage language, const std::filesystem::path& file);
void print_browser_launch(ConsoleLanguage language, std::string_view url, bool opened);

}
