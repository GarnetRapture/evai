#include "http/http_response.hpp"

#include <format>
#include <string>

namespace evai::server::http {

std::string serialize_response_head(const HttpResponseHead& head)
{
    return std::format(
        "HTTP/1.1 {} {}\r\n"
        "Content-Type: {}\r\n"
        "Content-Length: {}\r\n"
        "Cache-Control: no-cache\r\n"
        "Cross-Origin-Opener-Policy: same-origin\r\n"
        "Cross-Origin-Embedder-Policy: require-corp\r\n"
        "X-Content-Type-Options: nosniff\r\n"
        "Connection: close\r\n"
        "\r\n",
        head.status_code,
        head.reason,
        head.content_type,
        head.content_length);
}

}
