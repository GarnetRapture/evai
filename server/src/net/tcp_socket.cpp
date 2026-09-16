#include "net/tcp_socket.hpp"

#include <cerrno>
#include <cstddef>
#include <cstdint>
#include <format>
#include <span>
#include <stdexcept>
#include <string>
#include <utility>

namespace evai::server::net {

namespace {

constexpr int listen_backlog = 64;

#ifdef _WIN32
constexpr int send_flags = 0;
#elif defined(MSG_NOSIGNAL)
constexpr int send_flags = MSG_NOSIGNAL;
#else
constexpr int send_flags = 0;
#endif

void close_native(NativeSocketHandle handle)
{
#ifdef _WIN32
    closesocket(handle);
#else
    ::close(handle);
#endif
}

void configure_listener(NativeSocketHandle handle)
{
    int enabled = 1;
#ifdef _WIN32
    setsockopt(handle, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, static_cast<const char*>(static_cast<void*>(&enabled)), sizeof(enabled));
#else
    setsockopt(handle, SOL_SOCKET, SO_REUSEADDR, &enabled, sizeof(enabled));
#endif
}

int last_socket_error()
{
#ifdef _WIN32
    return WSAGetLastError();
#else
    return errno;
#endif
}

void configure_client(NativeSocketHandle handle)
{
#if defined(SO_NOSIGPIPE)
    int enabled = 1;
    setsockopt(handle, SOL_SOCKET, SO_NOSIGPIPE, &enabled, sizeof(enabled));
#else
    static_cast<void>(handle);
#endif
}

}

TcpSocket::TcpSocket(NativeSocketHandle handle)
    : handle_(handle)
{
}

TcpSocket::~TcpSocket()
{
    close_handle();
}

TcpSocket::TcpSocket(TcpSocket&& other) noexcept
    : handle_(std::exchange(other.handle_, invalid_native_socket))
{
}

TcpSocket& TcpSocket::operator=(TcpSocket&& other) noexcept
{
    if (this != &other) {
        close_handle();
        handle_ = std::exchange(other.handle_, invalid_native_socket);
    }
    return *this;
}

TcpSocket TcpSocket::listen_loopback(std::uint16_t port)
{
    TcpSocket listener(::socket(AF_INET, SOCK_STREAM, IPPROTO_TCP));
    if (!listener.valid()) {
        throw std::runtime_error("socket creation failed");
    }
    configure_listener(listener.handle_);
    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_port = htons(port);
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (::bind(listener.handle_, static_cast<sockaddr*>(static_cast<void*>(&address)), sizeof(address)) != 0) {
        throw std::runtime_error(std::format("cannot bind 127.0.0.1:{} (port already in use?)", port));
    }
    if (::listen(listener.handle_, listen_backlog) != 0) {
        throw std::runtime_error("listen failed");
    }
    return listener;
}

TcpSocket TcpSocket::connect_to(const std::string& host, std::uint16_t port)
{
    addrinfo hints{};
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_protocol = IPPROTO_TCP;
    addrinfo* resolved = nullptr;
    const std::string service = std::format("{}", port);
    const int resolve_status = ::getaddrinfo(host.c_str(), service.c_str(), &hints, &resolved);
    if (resolve_status != 0 || resolved == nullptr) {
        throw std::runtime_error(std::format("cannot resolve {}:{} (status {}, error {})", host, port, resolve_status, last_socket_error()));
    }
    std::string attempts;
    for (const addrinfo* candidate = resolved; candidate != nullptr; candidate = candidate->ai_next) {
        TcpSocket upstream(::socket(candidate->ai_family, candidate->ai_socktype, candidate->ai_protocol));
        if (!upstream.valid()) {
            attempts += std::format(" family {} socket error {};", candidate->ai_family, last_socket_error());
            continue;
        }
        if (::connect(upstream.handle_, candidate->ai_addr, static_cast<int>(candidate->ai_addrlen)) == 0) {
            ::freeaddrinfo(resolved);
            configure_client(upstream.handle_);
            return upstream;
        }
        attempts += std::format(" family {} connect error {};", candidate->ai_family, last_socket_error());
    }
    ::freeaddrinfo(resolved);
    throw std::runtime_error(std::format("cannot connect to {}:{}{}", host, port, attempts));
}

bool TcpSocket::valid() const
{
    return handle_ != invalid_native_socket;
}

TcpSocket TcpSocket::accept_client() const
{
    TcpSocket client(::accept(handle_, nullptr, nullptr));
    if (client.valid()) {
        configure_client(client.handle_);
    }
    return client;
}

std::size_t TcpSocket::receive_some(std::span<char> buffer) const
{
    const auto received = ::recv(handle_, buffer.data(), static_cast<int>(buffer.size()), 0);
    return received > 0 ? static_cast<std::size_t>(received) : 0;
}

void TcpSocket::send_all(std::span<const char> data) const
{
    while (!data.empty()) {
        const auto sent = ::send(handle_, data.data(), static_cast<int>(data.size()), send_flags);
        if (sent <= 0) {
            throw std::runtime_error("send failed");
        }
        data = data.subspan(static_cast<std::size_t>(sent));
    }
}

void TcpSocket::close_handle()
{
    if (valid()) {
        close_native(std::exchange(handle_, invalid_native_socket));
    }
}

}
