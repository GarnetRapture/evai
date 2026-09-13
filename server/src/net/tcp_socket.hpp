#pragma once

#include "net/native_socket.hpp"

#include <cstddef>
#include <cstdint>
#include <span>

namespace evai::server::net {

class TcpSocket {
public:
    TcpSocket() = default;
    explicit TcpSocket(NativeSocketHandle handle);
    ~TcpSocket();
    TcpSocket(const TcpSocket&) = delete;
    TcpSocket& operator=(const TcpSocket&) = delete;
    TcpSocket(TcpSocket&& other) noexcept;
    TcpSocket& operator=(TcpSocket&& other) noexcept;

    static TcpSocket listen_loopback(std::uint16_t port);

    [[nodiscard]] bool valid() const;
    [[nodiscard]] TcpSocket accept_client() const;
    [[nodiscard]] std::size_t receive_some(std::span<char> buffer) const;
    void send_all(std::span<const char> data) const;

private:
    void close_handle();

    NativeSocketHandle handle_ = invalid_native_socket;
};

}
