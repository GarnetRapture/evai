#include "platform/executable_directory.hpp"

#include <filesystem>
#include <stdexcept>
#include <string>

#ifdef _WIN32
#include <windows.h>
#elif defined(__APPLE__)
#include <cstdint>
#include <mach-o/dyld.h>
#endif

namespace evai::server::platform {

namespace {

std::filesystem::path resolve_executable_file()
{
#ifdef _WIN32
    std::wstring buffer(MAX_PATH, L'\0');
    for (;;) {
        const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
        if (length == 0) {
            throw std::runtime_error("GetModuleFileNameW failed");
        }
        if (length < buffer.size()) {
            buffer.resize(length);
            return std::filesystem::path(buffer);
        }
        buffer.resize(buffer.size() * 2);
    }
#elif defined(__APPLE__)
    std::uint32_t size = 0;
    _NSGetExecutablePath(nullptr, &size);
    std::string buffer(size, '\0');
    if (_NSGetExecutablePath(buffer.data(), &size) != 0) {
        throw std::runtime_error("_NSGetExecutablePath failed");
    }
    return std::filesystem::canonical(std::filesystem::path(buffer.c_str()));
#else
    return std::filesystem::canonical("/proc/self/exe");
#endif
}

}

std::filesystem::path resolve_executable_directory()
{
    return resolve_executable_file().parent_path();
}

}
