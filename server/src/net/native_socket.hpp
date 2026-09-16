#pragma once

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <arpa/inet.h>
#include <netdb.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
#endif

namespace evai::server::net {

#ifdef _WIN32
using NativeSocketHandle = SOCKET;
inline constexpr NativeSocketHandle invalid_native_socket = INVALID_SOCKET;
#else
using NativeSocketHandle = int;
inline constexpr NativeSocketHandle invalid_native_socket = -1;
#endif

}
