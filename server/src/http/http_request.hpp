#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace evai::server::http {

struct HttpHeader {
    std::string name;
    std::string value;
};

struct HttpRequest {
    std::string method;
    std::string target;
    std::string host;
    std::vector<HttpHeader> headers;
    std::string body;

    [[nodiscard]] std::string_view header(std::string_view name) const;
};

inline constexpr std::string_view http_header_terminator = "\r\n\r\n";
inline constexpr std::size_t http_header_limit_bytes = 16 * 1024;
inline constexpr std::size_t http_body_limit_bytes = static_cast<std::size_t>(512) * 1024 * 1024;

[[nodiscard]] std::optional<HttpRequest> parse_http_request(std::string_view header_block);
[[nodiscard]] std::optional<std::string> decode_request_path(std::string_view target);
[[nodiscard]] std::optional<std::size_t> parse_content_length(std::string_view value);
[[nodiscard]] bool equals_ignore_case(std::string_view left, std::string_view right);

}
