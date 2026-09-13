#include "browser_server.h"

#include <algorithm>
#include <array>
#include <atomic>
#include <charconv>
#include <condition_variable>
#include <deque>
#include <fstream>
#include <map>
#include <mutex>
#include <set>
#include <stdexcept>
#include <string_view>
#include <thread>
#include <utility>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <arpa/inet.h>
#include <cerrno>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
#endif

namespace eversoul::native {
namespace {
#ifdef _WIN32
using Socket = SOCKET;
constexpr Socket invalidSocket = INVALID_SOCKET;
void closeSocket(Socket socket) noexcept { if (socket != invalidSocket) closesocket(socket); }
void stopSocket(Socket socket) noexcept { shutdown(socket, SD_BOTH); }
struct SocketSystem {
    SocketSystem() { WSADATA data{}; if (WSAStartup(MAKEWORD(2, 2), &data) != 0) throw std::runtime_error("http_socket_init_failed"); }
    ~SocketSystem() { WSACleanup(); }
};
#else
using Socket = int;
constexpr Socket invalidSocket = -1;
void closeSocket(Socket socket) noexcept { if (socket != invalidSocket) ::close(socket); }
void stopSocket(Socket socket) noexcept { shutdown(socket, SHUT_RDWR); }
struct SocketSystem {};
#endif

constexpr std::size_t maximumBody = 8U * 1024U * 1024U;
constexpr std::size_t maximumHeaders = 16U * 1024U;
constexpr std::string_view endpoint = "/__eversoul/native-context";
// This implements the existing NativeContextBridge contract before the app's
// module executes. Chrome's native LanguageModel global remains browser-owned.
constexpr std::string_view bridge = R"bridge(<script>
Object.defineProperty(window, '__EVERSOUL_NATIVE_CONTEXT__', {value: Object.freeze({
  async send(request) {
    const response = await fetch('/__eversoul/native-context', {
      method: 'POST', credentials: 'same-origin',
      headers: {'Content-Type': 'application/json', 'X-EverSoul-Native': '1'},
      body: JSON.stringify(request)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'native_http_' + response.status);
    return result;
  }
})});
</script>)bridge";

std::string lower(std::string text) {
    for (char& character : text) if (character >= 'A' && character <= 'Z') character += 'a' - 'A';
    return text;
}
std::string_view trim(std::string_view text) {
    const auto first = text.find_first_not_of(" \t");
    return first == text.npos ? std::string_view{} : text.substr(first, text.find_last_not_of(" \t") - first + 1);
}
bool sendAll(Socket socket, std::string_view bytes) {
    while (!bytes.empty()) {
        const auto size = static_cast<int>(std::min<std::size_t>(bytes.size(), 65536));
#ifdef _WIN32
        const int count = ::send(socket, bytes.data(), size, 0);
#else
        const auto count = ::send(socket, bytes.data(), static_cast<std::size_t>(size), MSG_NOSIGNAL);
        if (count < 0 && errno == EINTR) continue;
#endif
        if (count <= 0) return false;
        bytes.remove_prefix(static_cast<std::size_t>(count));
    }
    return true;
}
bool receive(Socket socket, std::string& bytes) {
    std::array<char, 16384> buffer{};
    for (;;) {
        const auto count = ::recv(socket, buffer.data(), static_cast<int>(buffer.size()), 0);
#ifndef _WIN32
        if (count < 0 && errno == EINTR) continue;
#endif
        if (count <= 0) return false;
        bytes.append(buffer.data(), static_cast<std::size_t>(count));
        return true;
    }
}
void socketTimeouts(Socket socket) {
#ifdef _WIN32
    const DWORD timeout = 30000;
#else
    const timeval timeout{30, 0};
#endif
    setsockopt(socket, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
    setsockopt(socket, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
}
struct Request {
    std::string method;
    std::string path;
    std::map<std::string, std::string, std::less<>> headers;
    std::string body;
};
Request readRequest(Socket socket) {
    std::string bytes;
    std::size_t end;
    while ((end = bytes.find("\r\n\r\n")) == bytes.npos) {
        if (bytes.size() > maximumHeaders || !receive(socket, bytes)) throw std::runtime_error("invalid_http_headers");
    }
    if (end > maximumHeaders) throw std::runtime_error("http_headers_too_large");
    const auto lineEnd = bytes.find("\r\n");
    const std::string_view first(bytes.data(), lineEnd);
    const auto methodEnd = first.find(' ');
    const auto pathEnd = first.rfind(' ');
    if (methodEnd == first.npos || methodEnd == pathEnd || first.substr(pathEnd + 1) != "HTTP/1.1") {
        throw std::runtime_error("invalid_http_request");
    }
    Request request{std::string(first.substr(0, methodEnd)), std::string(first.substr(methodEnd + 1, pathEnd - methodEnd - 1)), {}, {}};
    for (std::size_t position = lineEnd + 2; position < end;) {
        const auto next = bytes.find("\r\n", position);
        const std::string_view line(bytes.data() + position, next - position);
        const auto colon = line.find(':');
        if (colon == line.npos || colon == 0) throw std::runtime_error("invalid_http_header");
        const std::string key = lower(std::string(line.substr(0, colon)));
        if (key.find_first_not_of("abcdefghijklmnopqrstuvwxyz0123456789-_") != key.npos
            || !request.headers.emplace(key, trim(line.substr(colon + 1))).second) {
            throw std::runtime_error("invalid_or_duplicate_http_header");
        }
        position = next + 2;
    }
    if (request.headers.contains("transfer-encoding") || request.headers.contains("expect")) {
        throw std::runtime_error("unsupported_http_transfer");
    }
    std::size_t length = 0;
    if (const auto found = request.headers.find("content-length"); found != request.headers.end()) {
        const auto& value = found->second;
        const auto parsed = std::from_chars(value.data(), value.data() + value.size(), length);
        if (parsed.ec != std::errc{} || parsed.ptr != value.data() + value.size() || length > maximumBody) {
            throw std::runtime_error("invalid_http_content_length");
        }
    }
    request.body = bytes.substr(end + 4);
    while (request.body.size() < length) if (!receive(socket, request.body)) throw std::runtime_error("incomplete_http_body");
    if (request.body.size() != length) throw std::runtime_error("invalid_http_body_length");
    return request;
}
void respond(Socket socket, int code, std::string_view type, std::string_view body) {
    const std::string headers = "HTTP/1.1 " + std::to_string(code)
        + (code == 200 ? " OK\r\n" : " Error\r\n")
        + "Content-Type: " + std::string(type) + "\r\nContent-Length: " + std::to_string(body.size())
        + "\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nX-Frame-Options: SAMEORIGIN"
          "\r\nReferrer-Policy: same-origin\r\nCross-Origin-Resource-Policy: same-origin\r\n\r\n";
    if (sendAll(socket, headers)) sendAll(socket, body);
}
std::string_view mimeType(const std::filesystem::path& file) {
    const auto extension = lower(file.extension().string());
    if (extension == ".html") return "text/html; charset=utf-8";
    if (extension == ".js" || extension == ".mjs") return "text/javascript; charset=utf-8";
    if (extension == ".css") return "text/css; charset=utf-8";
    if (extension == ".json") return "application/json";
    if (extension == ".wasm") return "application/wasm";
    if (extension == ".svg") return "image/svg+xml";
    if (extension == ".png") return "image/png";
    if (extension == ".webp") return "image/webp";
    if (extension == ".jpg" || extension == ".jpeg") return "image/jpeg";
    if (extension == ".ico") return "image/x-icon";
    if (extension == ".woff2") return "font/woff2";
    if (extension == ".mp3") return "audio/mpeg";
    if (extension == ".ogg") return "audio/ogg";
    return "application/octet-stream";
}
std::filesystem::path assetPath(const std::filesystem::path& root, std::string_view url) {
    url = url.substr(0, url.find('?'));
    if (url.empty() || url.front() != '/') throw std::runtime_error("invalid_asset_path");
    std::string decoded;
    for (std::size_t index = 1; index < url.size(); ++index) {
        char character = url[index];
        if (character == '%') {
            unsigned value = 0;
            if (index + 2 >= url.size()) throw std::runtime_error("invalid_url_encoding");
            const auto parsed = std::from_chars(url.data() + index + 1, url.data() + index + 3, value, 16);
            if (parsed.ec != std::errc{} || parsed.ptr != url.data() + index + 3) throw std::runtime_error("invalid_url_encoding");
            character = static_cast<char>(value);
            index += 2;
        }
        if (static_cast<unsigned char>(character) < 32 || character == '\\' || character == ':') throw std::runtime_error("invalid_asset_path");
        decoded += character;
    }
    const auto relative = std::filesystem::path(std::u8string(reinterpret_cast<const char8_t*>(decoded.data()), decoded.size()));
    if (relative.is_absolute()) throw std::runtime_error("invalid_asset_path");
    for (const auto& component : relative) if (component == "..") throw std::runtime_error("invalid_asset_path");
    auto candidate = std::filesystem::weakly_canonical(root / relative);
    if (std::filesystem::is_directory(candidate)) candidate /= "index.html";
    if (!std::filesystem::is_regular_file(candidate) && !relative.has_extension()) candidate = root / "index.html";
    candidate = std::filesystem::weakly_canonical(candidate);
    auto rootPart = root.begin();
    auto part = candidate.begin();
    for (; rootPart != root.end(); ++rootPart, ++part) {
        if (part == candidate.end() || *rootPart != *part) throw std::runtime_error("asset_outside_web_root");
    }
    return candidate;
}
}

class BrowserServer::Impl {
public:
    Impl(BrowserServerConfiguration configuration, LocalRequestHandler handler)
        : configuration_(std::move(configuration)), handler_(std::move(handler)) {
        configuration_.webRoot = std::filesystem::canonical(configuration_.webRoot);
        if (!std::filesystem::is_regular_file(configuration_.webRoot / "index.html")) throw std::runtime_error("web_build_index_not_found");
        origins_.insert("http://127.0.0.1:" + std::to_string(configuration_.port));
        origins_.insert("http://localhost:" + std::to_string(configuration_.port));
        if (!configuration_.publicOrigin.empty()) {
            const auto& origin = configuration_.publicOrigin;
            if (!origin.starts_with("https://") || origin.size() <= 8 || origin.substr(8).find_first_of("/\\@?# \t\r\n") != origin.npos) {
                throw std::runtime_error("invalid_public_https_origin");
            }
            origins_.insert(origin);
        }
        listener_ = ::socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (listener_ == invalidSocket) throw std::runtime_error("http_socket_failed");
        try {
            const int enabled = 1;
#ifdef _WIN32
            setsockopt(listener_, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, reinterpret_cast<const char*>(&enabled), sizeof(enabled));
#else
            setsockopt(listener_, SOL_SOCKET, SO_REUSEADDR, &enabled, sizeof(enabled));
#endif
            sockaddr_in address{};
            address.sin_family = AF_INET;
            address.sin_port = htons(configuration_.port);
            address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
            if (::bind(listener_, reinterpret_cast<const sockaddr*>(&address), sizeof(address)) != 0 || ::listen(listener_, 16) != 0) {
                throw std::runtime_error("http_loopback_bind_failed");
            }
            for (auto& worker : workers_) worker = std::jthread([this] { work(); });
            acceptor_ = std::jthread([this] { acceptConnections(); });
        }
        catch (...) { stop(); throw; }
    }
    ~Impl() { stop(); }
private:
    void stop() noexcept {
        stopping_.store(true);
        if (listener_ != invalidSocket) {
            stopSocket(listener_);
#ifdef _WIN32
            // A listening Winsock socket need not have a connected peer;
            // closesocket, rather than shutdown alone, releases accept().
            closeSocket(listener_);
#endif
        }
        if (acceptor_.joinable()) acceptor_.join();
#ifdef _WIN32
        listener_ = invalidSocket;
#else
        closeSocket(std::exchange(listener_, invalidSocket));
#endif
        {
            std::scoped_lock lock(mutex_);
            for (Socket socket : active_) stopSocket(socket);
            for (Socket socket : queue_) closeSocket(socket);
            queue_.clear();
        }
        condition_.notify_all();
        for (auto& worker : workers_) if (worker.joinable()) worker.join();
    }
    void acceptConnections() noexcept {
        while (!stopping_.load()) {
            const Socket client = ::accept(listener_, nullptr, nullptr);
            if (client == invalidSocket) {
#ifndef _WIN32
                if (errno == EINTR) continue;
#endif
                return;
            }
            socketTimeouts(client);
            std::scoped_lock lock(mutex_);
            if (stopping_.load() || queue_.size() >= 16) { closeSocket(client); continue; }
            queue_.push_back(client);
            condition_.notify_one();
        }
    }
    void work() noexcept {
        for (;;) {
            Socket client;
            {
                std::unique_lock lock(mutex_);
                condition_.wait(lock, [this] { return stopping_.load() || !queue_.empty(); });
                if (stopping_.load()) return;
                client = queue_.front();
                queue_.pop_front();
                active_.insert(client);
            }
            try { serve(client); }
            catch (...) { respond(client, 400, "application/json", R"({"ok":false,"error":"invalid_http_request"})"); }
            {
                std::scoped_lock lock(mutex_);
                active_.erase(client);
                closeSocket(client);
            }
        }
    }
    void serve(Socket socket) {
        const Request request = readRequest(socket);
        const auto host = request.headers.find("host");
        const auto origin = request.headers.find("origin");
        const bool knownHost = host != request.headers.end() && std::ranges::any_of(origins_, [&](const std::string& allowed) {
            return allowed.substr(allowed.find("://") + 3) == host->second;
        });
        if (!knownHost || (origin != request.headers.end() && !origins_.contains(origin->second))) {
            respond(socket, 403, "application/json", R"({"ok":false,"error":"native_origin_denied"})");
            return;
        }
        if (request.path == endpoint && request.method == "POST") {
            const auto contentType = request.headers.find("content-type");
            const auto marker = request.headers.find("x-eversoul-native");
            if (origin == request.headers.end() || marker == request.headers.end() || marker->second != "1"
                || contentType == request.headers.end() || trim(std::string_view(contentType->second).substr(0, contentType->second.find(';'))) != "application/json") {
                respond(socket, 403, "application/json", R"({"ok":false,"error":"native_bridge_headers_required"})");
                return;
            }
            respond(socket, 200, "application/json; charset=utf-8", handler_(request.body));
            return;
        }
        if (request.method != "GET" || request.path.starts_with("/__eversoul/")) {
            respond(socket, 404, "application/json", R"({"ok":false,"error":"http_route_not_found"})");
            return;
        }
        const auto path = assetPath(configuration_.webRoot, request.path);
        std::ifstream input(path, std::ios::binary | std::ios::ate);
        if (!input) { respond(socket, 404, "text/plain", "Not found"); return; }
        const auto length = input.tellg();
        if (length < 0 || length > 64 * 1024 * 1024) throw std::runtime_error("asset_too_large");
        std::string bytes(static_cast<std::size_t>(length), '\0');
        input.seekg(0);
        if (!input.read(bytes.data(), static_cast<std::streamsize>(bytes.size()))) throw std::runtime_error("asset_read_failed");
        if (path.extension() == ".html") {
            const auto head = bytes.find("<head>");
            if (head == bytes.npos) throw std::runtime_error("web_build_head_not_found");
            bytes.insert(head + 6, bridge);
        }
        respond(socket, 200, mimeType(path), bytes);
    }
    [[no_unique_address]] SocketSystem socketSystem_;
    BrowserServerConfiguration configuration_;
    LocalRequestHandler handler_;
    std::set<std::string, std::less<>> origins_;
    Socket listener_ = invalidSocket;
    std::atomic<bool> stopping_{false};
    std::mutex mutex_;
    std::condition_variable condition_;
    std::deque<Socket> queue_;
    std::set<Socket> active_;
    std::array<std::jthread, 8> workers_;
    std::jthread acceptor_;
};

BrowserServer::BrowserServer(BrowserServerConfiguration configuration, LocalRequestHandler handler)
    : impl_(std::make_unique<Impl>(std::move(configuration), std::move(handler))) {}
BrowserServer::~BrowserServer() = default;
}
