#include "http/http_request.hpp"

#include <algorithm>
#include <cctype>
#include <cstddef>
#include <optional>
#include <string>
#include <string_view>

namespace evai::server::http {

namespace {

constexpr std::string_view line_separator = "\r\n";
constexpr std::string_view host_header_name = "host";

std::string_view trim(std::string_view value)
{
    const auto first = value.find_first_not_of(" \t");
    if (first == std::string_view::npos) {
        return {};
    }
    const auto last = value.find_last_not_of(" \t");
    return value.substr(first, last - first + 1);
}

bool equals_ignore_case(std::string_view left, std::string_view right)
{
    return std::ranges::equal(left, right, [](unsigned char a, unsigned char b) { return std::tolower(a) == std::tolower(b); });
}

std::optional<int> hex_value(char character)
{
    if (character >= '0' && character <= '9') {
        return character - '0';
    }
    if (character >= 'a' && character <= 'f') {
        return character - 'a' + 10;
    }
    if (character >= 'A' && character <= 'F') {
        return character - 'A' + 10;
    }
    return std::nullopt;
}

}

std::optional<HttpRequest> parse_http_request(std::string_view header_block)
{
    const auto request_line_end = header_block.find(line_separator);
    if (request_line_end == std::string_view::npos) {
        return std::nullopt;
    }
    const std::string_view request_line = header_block.substr(0, request_line_end);
    const auto method_end = request_line.find(' ');
    const auto target_end = request_line.rfind(' ');
    if (method_end == std::string_view::npos || target_end == method_end) {
        return std::nullopt;
    }
    HttpRequest request{
        std::string(request_line.substr(0, method_end)),
        std::string(trim(request_line.substr(method_end + 1, target_end - method_end - 1))),
        {},
    };
    std::string_view remaining = header_block.substr(request_line_end + line_separator.size());
    while (!remaining.empty()) {
        const auto line_end = remaining.find(line_separator);
        const std::string_view line = remaining.substr(0, line_end);
        const auto colon = line.find(':');
        if (colon != std::string_view::npos && equals_ignore_case(trim(line.substr(0, colon)), host_header_name)) {
            request.host = std::string(trim(line.substr(colon + 1)));
        }
        if (line_end == std::string_view::npos) {
            break;
        }
        remaining = remaining.substr(line_end + line_separator.size());
    }
    return request;
}

std::optional<std::string> decode_request_path(std::string_view target)
{
    const std::string_view path = target.substr(0, target.find_first_of("?#"));
    if (path.empty() || path.front() != '/') {
        return std::nullopt;
    }
    std::string decoded;
    decoded.reserve(path.size());
    for (std::size_t index = 0; index < path.size(); ++index) {
        if (path[index] != '%') {
            decoded.push_back(path[index]);
            continue;
        }
        if (index + 2 >= path.size()) {
            return std::nullopt;
        }
        const auto high = hex_value(path[index + 1]);
        const auto low = hex_value(path[index + 2]);
        if (!high || !low) {
            return std::nullopt;
        }
        decoded.push_back(static_cast<char>((*high << 4) | *low));
        index += 2;
    }
    if (decoded.find('\0') != std::string::npos || decoded.find('\\') != std::string::npos) {
        return std::nullopt;
    }
    return decoded;
}

}
