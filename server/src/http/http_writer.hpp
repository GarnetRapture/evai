#pragma once

#include "net/tcp_socket.hpp"

#include <string_view>

namespace evai::server::http {

void send_response(const net::TcpSocket& client, int status_code, std::string_view reason, std::string_view content_type, std::string_view body, std::string_view extra_headers);
void send_status_text(const net::TcpSocket& client, int status_code, std::string_view reason);
void send_json(const net::TcpSocket& client, int status_code, std::string_view reason, std::string_view body);

}
