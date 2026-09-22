#pragma once

#include <filesystem>
#include <string_view>

namespace evai::server::app {

inline constexpr std::string_view error_log_file_name = "evai-server-error.log";

void configure_error_log(const std::filesystem::path& file);
void record_error(std::string_view scope, std::string_view detail);

}
