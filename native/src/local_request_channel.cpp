#include "local_request_channel.h"

#include <atomic>
#include <cctype>
#include <cstdio>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <utility>

#ifdef _WIN32
#include <windows.h>
#else
#include <cerrno>
#include <cstdlib>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <unistd.h>
#endif

namespace eversoul::native {
namespace {

constexpr std::size_t kMaximumLineBytes = 8U * 1024U * 1024U;
constexpr std::uint64_t kFnvOffsetBasis = 1469598103934665603ULL;
constexpr std::uint64_t kFnvPrime = 1099511628211ULL;

std::uint64_t fnv1a(std::string_view text) {
    std::uint64_t hash = kFnvOffsetBasis;
    for (unsigned char character : text) {
        hash ^= static_cast<std::uint64_t>(std::tolower(character));
        hash *= kFnvPrime;
    }
    return hash;
}

std::string hexadecimal(std::uint64_t value) {
    std::string text(16, '0');
    constexpr std::string_view digits = "0123456789abcdef";
    for (int index = 15; index >= 0; --index) {
        text[static_cast<std::size_t>(index)] = digits[value & 0xfU];
        value >>= 4U;
    }
    return text;
}

#ifdef _WIN32
using ChannelHandle = HANDLE;

std::wstring widen(const std::string& text) {
    const int length = MultiByteToWideChar(CP_UTF8, 0, text.data(), static_cast<int>(text.size()), nullptr, 0);
    std::wstring wide(static_cast<std::size_t>(length), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, text.data(), static_cast<int>(text.size()), wide.data(), length);
    return wide;
}

bool writeAll(ChannelHandle handle, std::string_view data) {
    while (!data.empty()) {
        DWORD written = 0;
        if (!WriteFile(handle, data.data(), static_cast<DWORD>(data.size()), &written, nullptr) || written == 0) return false;
        data.remove_prefix(written);
    }
    return true;
}

bool readSome(ChannelHandle handle, std::string& buffer) {
    char chunk[16384];
    DWORD read = 0;
    if (!ReadFile(handle, chunk, sizeof(chunk), &read, nullptr) || read == 0) return false;
    buffer.append(chunk, read);
    return true;
}

void closeChannel(ChannelHandle handle) {
    if (handle != INVALID_HANDLE_VALUE) CloseHandle(handle);
}
#else
using ChannelHandle = int;

bool writeAll(ChannelHandle handle, std::string_view data) {
    while (!data.empty()) {
        const ssize_t written = ::send(handle, data.data(), data.size(), MSG_NOSIGNAL);
        if (written <= 0) return false;
        data.remove_prefix(static_cast<std::size_t>(written));
    }
    return true;
}

bool readSome(ChannelHandle handle, std::string& buffer) {
    char chunk[16384];
    const ssize_t read = ::recv(handle, chunk, sizeof(chunk), 0);
    if (read <= 0) return false;
    buffer.append(chunk, static_cast<std::size_t>(read));
    return true;
}

void closeChannel(ChannelHandle handle) {
    if (handle >= 0) ::close(handle);
}

sockaddr_un socketAddress(const std::string& endpoint) {
    sockaddr_un address{};
    address.sun_family = AF_UNIX;
    if (endpoint.size() >= sizeof(address.sun_path)) throw std::runtime_error("local_request_endpoint_too_long");
    endpoint.copy(address.sun_path, endpoint.size());
    return address;
}
#endif

bool readLine(ChannelHandle handle, std::string& buffer, std::string& line) {
    for (;;) {
        const std::size_t newline = buffer.find('\n');
        if (newline != std::string::npos) {
            line.assign(buffer, 0, newline);
            buffer.erase(0, newline + 1);
            if (!line.empty() && line.back() == '\r') line.pop_back();
            return true;
        }
        if (buffer.size() > kMaximumLineBytes) return false;
        if (!readSome(handle, buffer)) return false;
    }
}

void serveConnection(ChannelHandle handle, const LocalRequestHandler& handler, const std::atomic<bool>& stopping) {
    std::string buffer;
    std::string line;
    while (!stopping.load(std::memory_order_relaxed) && readLine(handle, buffer, line)) {
        if (line.empty()) continue;
        std::string response = handler(line);
        response.push_back('\n');
        if (!writeAll(handle, response)) break;
    }
#ifdef _WIN32
    FlushFileBuffers(handle);
    DisconnectNamedPipe(handle);
#endif
    closeChannel(handle);
}

}

std::string localRequestEndpoint(const std::filesystem::path& executablePath) {
    const std::u8string normalized = std::filesystem::absolute(executablePath).lexically_normal().generic_u8string();
    const std::string key = hexadecimal(fnv1a(std::string_view(reinterpret_cast<const char*>(normalized.data()), normalized.size())));
#ifdef _WIN32
    return "\\\\.\\pipe\\eversoul-native-host-" + key;
#else
    const char* runtimeDirectory = std::getenv("XDG_RUNTIME_DIR");
    const std::string directory = runtimeDirectory != nullptr && runtimeDirectory[0] != '\0' ? runtimeDirectory : "/tmp";
    return directory + "/eversoul-native-host-" + key + ".sock";
#endif
}

struct LocalRequestServer::State {
    std::string endpoint;
    LocalRequestHandler handler;
    std::atomic<bool> stopping{false};
#ifndef _WIN32
    int listener = -1;
#endif
};

LocalRequestServer::LocalRequestServer(std::string endpoint, LocalRequestHandler handler)
    : state_(std::make_shared<State>()) {
    state_->endpoint = std::move(endpoint);
    state_->handler = std::move(handler);
#ifdef _WIN32
    std::thread([state = state_] {
        const std::wstring name = widen(state->endpoint);
        while (!state->stopping.load(std::memory_order_relaxed)) {
            HANDLE pipe = CreateNamedPipeW(
                name.c_str(), PIPE_ACCESS_DUPLEX,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                PIPE_UNLIMITED_INSTANCES, 65536, 65536, 0, nullptr);
            if (pipe == INVALID_HANDLE_VALUE) return;
            const bool connected = ConnectNamedPipe(pipe, nullptr) ? true : GetLastError() == ERROR_PIPE_CONNECTED;
            if (!connected || state->stopping.load(std::memory_order_relaxed)) {
                CloseHandle(pipe);
                continue;
            }
            std::thread([state, pipe] { serveConnection(pipe, state->handler, state->stopping); }).detach();
        }
    }).detach();
#else
    const sockaddr_un address = socketAddress(state_->endpoint);
    ::unlink(state_->endpoint.c_str());
    state_->listener = ::socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC, 0);
    if (state_->listener < 0) throw std::runtime_error("local_request_socket_failed");
    if (::bind(state_->listener, reinterpret_cast<const sockaddr*>(&address), sizeof(address)) != 0
        || ::chmod(state_->endpoint.c_str(), 0600) != 0
        || ::listen(state_->listener, 8) != 0) {
        ::close(state_->listener);
        state_->listener = -1;
        throw std::runtime_error("local_request_socket_bind_failed");
    }
    std::thread([state = state_] {
        while (!state->stopping.load(std::memory_order_relaxed)) {
            const int client = ::accept4(state->listener, nullptr, nullptr, SOCK_CLOEXEC);
            if (client < 0) {
                if (errno == EINTR) continue;
                return;
            }
            std::thread([state, client] { serveConnection(client, state->handler, state->stopping); }).detach();
        }
    }).detach();
#endif
}

LocalRequestServer::~LocalRequestServer() {
    state_->stopping.store(true, std::memory_order_relaxed);
#ifdef _WIN32
    HANDLE wake = CreateFileW(widen(state_->endpoint).c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, 0, nullptr);
    if (wake != INVALID_HANDLE_VALUE) CloseHandle(wake);
#else
    ::shutdown(state_->listener, SHUT_RDWR);
    ::close(state_->listener);
    ::unlink(state_->endpoint.c_str());
#endif
}

std::unique_ptr<LocalRequestClient> LocalRequestClient::connect(const std::string& endpoint, std::string& error) {
#ifdef _WIN32
    const std::wstring name = widen(endpoint);
    for (int attempt = 0; attempt < 50; ++attempt) {
        HANDLE pipe = CreateFileW(name.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, 0, nullptr);
        if (pipe != INVALID_HANDLE_VALUE) {
            error.clear();
            return std::unique_ptr<LocalRequestClient>(new LocalRequestClient(reinterpret_cast<std::intptr_t>(pipe)));
        }
        if (GetLastError() != ERROR_PIPE_BUSY && GetLastError() != ERROR_FILE_NOT_FOUND) break;
        WaitNamedPipeW(name.c_str(), 100);
    }
    error = "local_request_connect_failed:" + std::to_string(GetLastError());
    return nullptr;
#else
    int client = ::socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC, 0);
    if (client < 0) {
        error = "local_request_socket_failed";
        return nullptr;
    }
    const sockaddr_un address = socketAddress(endpoint);
    if (::connect(client, reinterpret_cast<const sockaddr*>(&address), sizeof(address)) != 0) {
        ::close(client);
        error = "local_request_connect_failed:" + std::to_string(errno);
        return nullptr;
    }
    error.clear();
    return std::unique_ptr<LocalRequestClient>(new LocalRequestClient(client));
#endif
}

LocalRequestClient::LocalRequestClient(std::intptr_t handle) noexcept : handle_(handle) {}

LocalRequestClient::~LocalRequestClient() {
#ifdef _WIN32
    closeChannel(reinterpret_cast<HANDLE>(handle_));
#else
    closeChannel(static_cast<int>(handle_));
#endif
}

std::string LocalRequestClient::exchange(std::string_view requestLine) {
#ifdef _WIN32
    const ChannelHandle handle = reinterpret_cast<HANDLE>(handle_);
#else
    const ChannelHandle handle = static_cast<int>(handle_);
#endif
    std::string request(requestLine);
    request.push_back('\n');
    if (!writeAll(handle, request)) throw std::runtime_error("local_request_write_failed");
    std::string line;
    if (!readLine(handle, buffer_, line)) throw std::runtime_error("local_request_read_failed");
    return line;
}

}
