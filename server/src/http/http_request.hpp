#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <string_view>

namespace evai::server::http {

struct HttpRequest {
    std::string method;
    std::string target;
    std::string host;
};

inline constexpr std::string_view http_header_terminator = "\r\n\r\n";
inline constexpr std::size_t http_header_limit_bytes = 16 * 1024;

[[nodiscard]] std::optional<HttpRequest> parse_http_request(std::string_view header_block);
[[nodiscard]] std::optional<std::string> decode_request_path(std::string_view target);

}
