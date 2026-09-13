#pragma once

#include <cstdint>
#include <string>
#include <string_view>

namespace evai::server::http {

struct HttpResponseHead {
    int status_code;
    std::string_view reason;
    std::string_view content_type;
    std::uintmax_t content_length;
};

[[nodiscard]] std::string serialize_response_head(const HttpResponseHead& head);

}
