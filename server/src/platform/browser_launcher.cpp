#include "platform/browser_launcher.hpp"

#include <cstddef>
#include <string>

#ifdef _WIN32
#include <windows.h>
#include <shellapi.h>
#else
#include <spawn.h>
#include <sys/types.h>
#include <sys/wait.h>
extern char** environ;
#endif

namespace evai::server::platform {

namespace {

#ifdef _WIN32
constexpr INT_PTR shell_execute_success_threshold = 32;

std::wstring to_wide(const std::string& text)
{
    if (text.empty()) {
        return {};
    }
    const int length = MultiByteToWideChar(CP_UTF8, 0, text.data(), static_cast<int>(text.size()), nullptr, 0);
    std::wstring wide(static_cast<std::size_t>(length), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, text.data(), static_cast<int>(text.size()), wide.data(), length);
    return wide;
}
#else
#ifdef __APPLE__
constexpr const char* browser_opener = "open";
#else
constexpr const char* browser_opener = "xdg-open";
#endif
#endif

}

bool open_default_browser(const std::string& url)
{
#ifdef _WIN32
    const std::wstring wide_url = to_wide(url);
    const HINSTANCE result = ShellExecuteW(nullptr, L"open", wide_url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
    return reinterpret_cast<INT_PTR>(result) > shell_execute_success_threshold;
#else
    std::string opener(browser_opener);
    std::string target(url);
    char* const arguments[] = {opener.data(), target.data(), nullptr};
    pid_t child = 0;
    if (posix_spawnp(&child, browser_opener, nullptr, nullptr, arguments, environ) != 0) {
        return false;
    }
    int status = 0;
    return waitpid(child, &status, 0) == child && WIFEXITED(status) && WEXITSTATUS(status) == 0;
#endif
}

}
