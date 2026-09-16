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
inline constexpr std::string_view ollama_base_url_header = "X-Evai-Ollama-Base-Url";

struct OllamaProbe {
    bool available;
    std::string detail;
};

[[nodiscard]] std::optional<OllamaUpstream> parse_ollama_base_url(std::string_view base_url);

[[nodiscard]] OllamaProbe probe_ollama(std::string_view base_url);

void proxy_ollama_request(const net::TcpSocket& client, const http::HttpRequest& request, std::string_view upstream_path);

}
