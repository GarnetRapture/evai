#include "net/socket_runtime.hpp"

#include "net/native_socket.hpp"

#include <csignal>
#include <stdexcept>

namespace evai::server::net {

SocketRuntime::SocketRuntime()
{
#ifdef _WIN32
    WSADATA data{};
    if (WSAStartup(MAKEWORD(2, 2), &data) != 0) {
        throw std::runtime_error("WSAStartup failed");
    }
#else
    std::signal(SIGPIPE, SIG_IGN);
#endif
}

SocketRuntime::~SocketRuntime()
{
#ifdef _WIN32
    WSACleanup();
#endif
}

}
