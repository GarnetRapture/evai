#include "platform/executable_directory.hpp"

#include <filesystem>
#include <iostream>
#include <iterator>
#include <stdexcept>
#include <string>

#ifdef _WIN32
#include <windows.h>
#else
#include <cstdio>
#include <unistd.h>
#ifdef __APPLE__
#include <cstdint>
#include <mach-o/dyld.h>
#endif
#endif

namespace evai::server::platform {

namespace {

#ifdef _WIN32
constexpr const wchar_t* console_window_title = L"EverSoul AI Chat by Nekoi - Server";
constexpr int application_icon_id = 101;
#endif

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

void apply_console_identity()
{
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
    const HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
    DWORD console_mode = 0;
    if (output != INVALID_HANDLE_VALUE && GetConsoleMode(output, &console_mode)) {
        SetConsoleMode(output, console_mode | ENABLE_VIRTUAL_TERMINAL_PROCESSING);
    }
    SetConsoleTitleW(console_window_title);
    const HWND console_window = GetConsoleWindow();
    if (console_window == nullptr) {
        return;
    }
    const HMODULE module = GetModuleHandleW(nullptr);
    const HICON large_icon = static_cast<HICON>(LoadImageW(module, MAKEINTRESOURCEW(application_icon_id), IMAGE_ICON,
        GetSystemMetrics(SM_CXICON), GetSystemMetrics(SM_CYICON), LR_DEFAULTCOLOR));
    const HICON small_icon = static_cast<HICON>(LoadImageW(module, MAKEINTRESOURCEW(application_icon_id), IMAGE_ICON,
        GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), LR_DEFAULTCOLOR));
    if (large_icon != nullptr) {
        SendMessageW(console_window, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(large_icon));
    }
    if (small_icon != nullptr) {
        SendMessageW(console_window, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(small_icon));
    }
#endif
}

bool owns_console_window()
{
#ifdef _WIN32
    DWORD processes[2]{};
    return GetConsoleProcessList(processes, static_cast<DWORD>(std::size(processes))) == 1;
#else
    return false;
#endif
}

void wait_for_console_close()
{
#ifndef _WIN32
    if (!isatty(fileno(stdin))) {
        return;
    }
#else
    if (!owns_console_window()) {
        return;
    }
#endif
    std::cerr << "press Enter to close this window." << std::endl;
    std::string discarded;
    std::getline(std::cin, discarded);
}

}
