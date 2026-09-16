#pragma once

#include "http/http_request.hpp"
#include "net/tcp_socket.hpp"

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>

namespace evai::server::api {

struct OllamaUpstream {
    std::string host;
    std::uint16_t port;
};

inline constexpr std::string_view ollama_proxy_prefix = "/api/ollama";
inline constexpr std::string_view default_ollama_base_url = "http://127.0.0.1:11434";

struct OllamaProbe {
    bool available;
    std::string detail;
};

[[nodiscard]] std::optional<OllamaUpstream> parse_ollama_base_url(std::string_view base_url);

[[nodiscard]] OllamaProbe probe_ollama(std::string_view base_url);

[[nodiscard]] std::string resolve_ollama_base_url(const std::optional<std::string>& stored_base_url);

void proxy_ollama_request(const net::TcpSocket& client, const http::HttpRequest& request, std::string_view base_url, std::string_view upstream_path);

}
