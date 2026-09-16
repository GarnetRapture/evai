#include "http/http_writer.hpp"

#include "http/http_response.hpp"
#include "net/tcp_socket.hpp"

#include <format>
#include <string>
#include <string_view>

namespace evai::server::http {

void send_response(const net::TcpSocket& client, int status_code, std::string_view reason, std::string_view content_type, std::string_view body, std::string_view extra_headers)
{
    client.send_all(serialize_response_head({status_code, reason, content_type, body.size(), extra_headers}));
    client.send_all(body);
}

void send_status_text(const net::TcpSocket& client, int status_code, std::string_view reason)
{
    const std::string body = std::format("{} {}\n", status_code, reason);
    send_response(client, status_code, reason, plain_text_content_type, body, {});
}

void send_json(const net::TcpSocket& client, int status_code, std::string_view reason, std::string_view body)
{
    send_response(client, status_code, reason, json_content_type, body, {});
}

}
