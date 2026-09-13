#include "native_settings.h"

#include <fstream>
#include <stdexcept>
#include <utility>
#include <vector>

#ifdef _WIN32
#include <windows.h>
#endif

namespace eversoul::native {
namespace {

std::string_view trim(std::string_view value) {
    const std::size_t first = value.find_first_not_of(" \t\r\n");
    if (first == std::string_view::npos) return {};
    const std::size_t last = value.find_last_not_of(" \t\r\n");
    return value.substr(first, last - first + 1);
}

std::string keyFromLine(std::string_view line) {
    const std::size_t separator = line.find('=');
    if (separator == std::string_view::npos) return {};
    return std::string(trim(line.substr(0, separator)));
}

void replaceFile(const std::filesystem::path& source, const std::filesystem::path& destination) {
#ifdef _WIN32
    if (!MoveFileExW(source.c_str(), destination.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
        std::error_code ignored;
        std::filesystem::remove(source, ignored);
        throw std::runtime_error("native_host_ini_replace_failed");
    }
#else
    std::error_code error;
    std::filesystem::rename(source, destination, error);
    if (error) {
        std::filesystem::remove(source, error);
        throw std::runtime_error("native_host_ini_replace_failed");
    }
#endif
}

}

NativeSettings readNativeSettings(const std::filesystem::path& path) {
    NativeSettings settings;
    std::ifstream input(path);
    std::string line;
    while (std::getline(input, line)) {
        const std::string key = keyFromLine(line);
        if (key.empty()) continue;
        const std::size_t separator = line.find('=');
        settings.insert_or_assign(key, std::string(trim(std::string_view(line).substr(separator + 1))));
    }
    return settings;
}

void updateNativeSettings(const std::filesystem::path& path, const NativeSettings& updates) {
    for (const auto& [key, value] : updates) {
        if (key.empty() || key.find_first_of("=\r\n\0", 0, 4) != key.npos
            || value.find_first_of("\r\n\0", 0, 3) != value.npos) {
            throw std::runtime_error("invalid_native_setting");
        }
    }
    std::vector<std::string> lines;
    {
        std::ifstream input(path);
        std::string line;
        while (std::getline(input, line)) lines.push_back(std::move(line));
    }

    NativeSettings remaining = updates;
    for (std::string& line : lines) {
        const std::string key = keyFromLine(line);
        const auto replacement = updates.find(key);
        if (replacement == updates.end()) continue;
        line = replacement->first + '=' + replacement->second;
        remaining.erase(key);
    }
    if (!remaining.empty()) {
        if (!lines.empty() && !lines.back().empty()) lines.emplace_back();
        lines.emplace_back("[inference]");
        for (const auto& [key, value] : remaining) lines.push_back(key + '=' + value);
    }

    std::filesystem::path temporary = path;
    temporary += ".tmp";
    {
        std::ofstream output(temporary, std::ios::trunc | std::ios::binary);
        if (!output) throw std::runtime_error("native_host_ini_write_failed");
        for (const std::string& line : lines) output << line << '\n';
        output.flush();
        if (!output) throw std::runtime_error("native_host_ini_write_failed");
    }
    replaceFile(temporary, path);
}

}
