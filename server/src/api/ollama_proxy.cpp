#include "api/ollama_proxy.hpp"

#include "http/http_request.hpp"
#include "http/http_response.hpp"
#include "http/http_writer.hpp"
#include "net/tcp_socket.hpp"

#include <array>
#include <charconv>
#include <cstddef>
#include <cstdint>
#include <exception>
#include <format>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <system_error>

namespace evai::server::api {

namespace {

constexpr std::string_view http_scheme = "http://";
constexpr std::uint16_t default_http_port = 80;
constexpr std::size_t relay_chunk_bytes = 32 * 1024;
constexpr std::string_view upstream_unreachable_header = "X-Evai-Proxy-Error: upstream_unreachable\r\n";

bool is_host_character(char character)
{
    return (character >= 'a' && character <= 'z')
        || (character >= 'A' && character <= 'Z')
        || (character >= '0' && character <= '9')
        || character == '.' || character == '-' || character == '_';
}

}

std::optional<OllamaUpstream> parse_ollama_base_url(std::string_view base_url)
{
    if (!base_url.starts_with(http_scheme)) {
        return std::nullopt;
    }
    std::string_view authority = base_url.substr(http_scheme.size());
    if (authority.ends_with('/')) {
        authority.remove_suffix(1);
    }
    if (authority.empty() || authority.find('/') != std::string_view::npos) {
        return std::nullopt;
    }
    std::string_view host = authority;
    std::uint16_t port = default_http_port;
    const auto colon = authority.rfind(':');
    if (colon != std::string_view::npos) {
        const std::string_view port_text = authority.substr(colon + 1);
        unsigned int parsed = 0;
        const auto [end, error] = std::from_chars(port_text.data(), port_text.data() + port_text.size(), parsed);
        if (error != std::errc{} || end != port_text.data() + port_text.size() || parsed == 0 || parsed > 65535) {
            return std::nullopt;
        }
        port = static_cast<std::uint16_t>(parsed);
        host = authority.substr(0, colon);
    }
    if (host.empty()) {
        return std::nullopt;
    }
    for (const char character : host) {
        if (!is_host_character(character)) {
            return std::nullopt;
        }
    }
    return OllamaUpstream{std::string(host), port};
}

OllamaProbe probe_ollama(std::string_view base_url)
{
    const std::optional<OllamaUpstream> upstream = parse_ollama_base_url(base_url);
    if (!upstream.has_value()) {
        return OllamaProbe{false, std::format("invalid address: {}", base_url)};
    }
    try {
        const net::TcpSocket connection = net::TcpSocket::connect_to(upstream->host, upstream->port);
        connection.send_all(std::format(
            "GET /api/version HTTP/1.1\r\nHost: {}:{}\r\nAccept: application/json\r\nConnection: close\r\n\r\n",
            upstream->host,
            upstream->port));
        std::string response;
        std::array<char, relay_chunk_bytes> chunk{};
        for (;;) {
            const std::size_t received = connection.receive_some(chunk);
            if (received == 0) {
                break;
            }
            response.append(chunk.data(), received);
            if (response.size() > relay_chunk_bytes) {
                break;
            }
        }
        const auto version_start = response.find("\"version\"");
        if (response.find(" 200 ") == std::string::npos || version_start == std::string::npos) {
            return OllamaProbe{false, response.substr(0, response.find("\r\n"))};
        }
        const auto value_start = response.find('"', response.find(':', version_start)) + 1;
        const auto value_end = response.find('"', value_start);
        return OllamaProbe{true, response.substr(value_start, value_end - value_start)};
    }
    catch (const std::exception& error) {
        return OllamaProbe{false, error.what()};
    }
}

void proxy_ollama_request(const net::TcpSocket& client, const http::HttpRequest& request, std::string_view upstream_path)
{
    const std::optional<OllamaUpstream> upstream = parse_ollama_base_url(request.header(ollama_base_url_header));
    if (!upstream.has_value()) {
        http::send_json(client, 400, "Bad Request", http::json_error_body("invalid_upstream", request.header(ollama_base_url_header)));
        return;
    }
    net::TcpSocket connection;
    try {
        connection = net::TcpSocket::connect_to(upstream->host, upstream->port);
    }
    catch (const std::exception& error) {
        http::send_response(
            client,
            502,
            "Bad Gateway",
            http::json_content_type,
            http::json_error_body("upstream_unreachable", error.what()),
            upstream_unreachable_header);
        return;
    }
    const std::string_view content_type = request.header("Content-Type");
    const std::string head = std::format(
        "{} {} HTTP/1.1\r\n"
        "Host: {}:{}\r\n"
        "Accept: {}\r\n"
        "{}"
        "Content-Length: {}\r\n"
        "Connection: close\r\n"
        "\r\n",
        request.method,
        upstream_path,
        upstream->host,
        upstream->port,
        request.header("Accept").empty() ? std::string_view("*/*") : request.header("Accept"),
        content_type.empty() ? std::string{} : std::format("Content-Type: {}\r\n", content_type),
        request.body.size());
    connection.send_all(head);
    if (!request.body.empty()) {
        connection.send_all(request.body);
    }
    std::array<char, relay_chunk_bytes> chunk{};
    for (;;) {
        const std::size_t received = connection.receive_some(chunk);
        if (received == 0) {
            return;
        }
        client.send_all(std::span<const char>(chunk.data(), received));
    }
}

}
