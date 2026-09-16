#include "http/http_response.hpp"

#include <format>
#include <string>
#include <string_view>

namespace evai::server::http {

std::string serialize_response_head(const HttpResponseHead& head)
{
    return std::format(
        "HTTP/1.1 {} {}\r\n"
        "Content-Type: {}\r\n"
        "Content-Length: {}\r\n"
        "Cache-Control: no-store\r\n"
        "Cross-Origin-Opener-Policy: same-origin\r\n"
        "Cross-Origin-Embedder-Policy: require-corp\r\n"
        "X-Content-Type-Options: nosniff\r\n"
        "Connection: close\r\n"
        "{}"
        "\r\n",
        head.status_code,
        head.reason,
        head.content_type,
        head.content_length,
        head.extra_headers);
}

std::string json_escaped(std::string_view value)
{
    std::string escaped;
    escaped.reserve(value.size() + 2);
    for (const char character : value) {
        switch (character) {
            case '"':
                escaped += "\\\"";
                break;
            case '\\':
                escaped += "\\\\";
                break;
            case '\n':
                escaped += "\\n";
                break;
            case '\r':
                escaped += "\\r";
                break;
            case '\t':
                escaped += "\\t";
                break;
            default:
                if (static_cast<unsigned char>(character) < 0x20) {
                    escaped += std::format("\\u{:04x}", static_cast<unsigned int>(static_cast<unsigned char>(character)));
                }
                else {
                    escaped.push_back(character);
                }
                break;
        }
    }
    return escaped;
}

std::string json_error_body(std::string_view code, std::string_view detail)
{
    return std::format("{{\"error\":\"{}\",\"detail\":\"{}\"}}", json_escaped(code), json_escaped(detail));
}

}
