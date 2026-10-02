#pragma once

#include "http/http_response.hpp"
#include "net/tcp_socket.hpp"

#include <string_view>

namespace evai::server::http {

struct HttpChannel {
    const net::TcpSocket& socket;
    ConnectionPersistence persistence;
};

void send_response(const HttpChannel& channel, int status_code, std::string_view reason, std::string_view content_type, std::string_view body, std::string_view extra_headers);
void send_status_text(const HttpChannel& channel, int status_code, std::string_view reason);
void send_json(const HttpChannel& channel, int status_code, std::string_view reason, std::string_view body);

}
