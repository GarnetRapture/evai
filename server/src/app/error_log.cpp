#include "app/error_log.hpp"

#include <chrono>
#include <filesystem>
#include <format>
#include <fstream>
#include <mutex>
#include <string_view>

namespace evai::server::app {

namespace {

std::filesystem::path log_file;
std::mutex log_mutex;

}

void configure_error_log(const std::filesystem::path& file)
{
    const std::lock_guard<std::mutex> lock(log_mutex);
    log_file = file;
}

void record_error(std::string_view scope, std::string_view detail)
{
    const std::lock_guard<std::mutex> lock(log_mutex);
    if (log_file.empty()) {
        return;
    }
    std::ofstream stream(log_file, std::ios::app);
    if (!stream) {
        return;
    }
    stream << std::format("{:%FT%TZ} [{}] {}\n", std::chrono::floor<std::chrono::seconds>(std::chrono::system_clock::now()), scope, detail);
}

}
