#pragma once

#include "app/server_config.hpp"

#include <cstdint>
#include <filesystem>
#include <string>
#include <string_view>

namespace evai::server::app {

struct ServerStatusReport {
    std::filesystem::path root_directory;
    std::filesystem::path database_file;
    std::string database_schema_version;
    std::int64_t database_record_count;
    std::string ollama_base_url;
    bool ollama_available;
    std::string ollama_detail;
    std::uint16_t port;
};

void prepare_console();
void print_banner();
[[nodiscard]] ConsoleLanguage choose_console_language();
void print_status_report(ConsoleLanguage language, const ServerStatusReport& report);
void print_startup_failure(ConsoleLanguage language, std::string_view detail);
void print_config_location(ConsoleLanguage language, const std::filesystem::path& file);

}
