#pragma once

#include <chrono>
#include <cstdint>
#include <string>
#include <string_view>

namespace evai::server::http {

enum class ConnectionPersistence {
    keep_alive,
    close,
};

struct HttpResponseHead {
    int status_code;
    std::string_view reason;
    std::string_view content_type;
    std::uintmax_t content_length;
    std::string_view extra_headers;
    ConnectionPersistence persistence;
};

inline constexpr std::string_view json_content_type = "application/json; charset=utf-8";
inline constexpr std::string_view plain_text_content_type = "text/plain; charset=utf-8";
inline constexpr std::chrono::seconds keep_alive_idle_timeout{75};

[[nodiscard]] std::string serialize_response_head(const HttpResponseHead& head);
[[nodiscard]] std::string json_escaped(std::string_view value);
[[nodiscard]] std::string json_error_body(std::string_view code, std::string_view detail);

}
