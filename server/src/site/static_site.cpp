#include "site/static_site.hpp"

#include "http/http_request.hpp"
#include "http/http_response.hpp"
#include "http/mime_type.hpp"
#include "net/tcp_socket.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <exception>
#include <filesystem>
#include <format>
#include <fstream>
#include <iostream>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <system_error>

namespace evai::server::site {

namespace {

constexpr std::string_view index_file_name = "index.html";
constexpr std::string_view plain_text_type = "text/plain; charset=utf-8";
constexpr std::size_t receive_chunk_bytes = 4096;
constexpr std::size_t file_chunk_bytes = 64 * 1024;

struct ResolvedFile {
    std::filesystem::path path;
    std::uintmax_t size;
};

std::optional<std::string> receive_header_block(const net::TcpSocket& client)
{
    std::string buffer;
    std::array<char, receive_chunk_bytes> chunk{};
    while (buffer.size() < http::http_header_limit_bytes) {
        const std::size_t received = client.receive_some(chunk);
        if (received == 0) {
            return std::nullopt;
        }
        buffer.append(chunk.data(), received);
        const auto terminator = buffer.find(http::http_header_terminator);
        if (terminator != std::string::npos) {
            buffer.resize(terminator + http::http_header_terminator.size());
            return buffer;
        }
    }
    return std::nullopt;
}

void send_text(const net::TcpSocket& client, int status_code, std::string_view reason)
{
    const std::string body = std::format("{} {}\n", status_code, reason);
    const std::string head = http::serialize_response_head({status_code, reason, plain_text_type, body.size()});
    client.send_all(head);
    client.send_all(body);
}

bool is_within_root(const std::filesystem::path& root, const std::filesystem::path& candidate)
{
    return std::mismatch(root.begin(), root.end(), candidate.begin(), candidate.end()).first == root.end();
}

std::optional<ResolvedFile> resolve_file(const StaticSiteContext& context, std::string_view request_path)
{
    std::filesystem::path relative = std::filesystem::path(std::u8string(request_path.begin(), request_path.end())).relative_path();
    std::error_code error;
    std::filesystem::path candidate = std::filesystem::weakly_canonical(context.root_directory / relative, error);
    if (error || !is_within_root(context.root_directory, candidate)) {
        return std::nullopt;
    }
    if (std::filesystem::is_directory(candidate, error)) {
        candidate /= index_file_name;
    }
    if (!std::filesystem::is_regular_file(candidate, error)) {
        return std::nullopt;
    }
    const std::uintmax_t size = std::filesystem::file_size(candidate, error);
    if (error) {
        return std::nullopt;
    }
    return ResolvedFile{candidate, size};
}

void send_file(const net::TcpSocket& client, const ResolvedFile& file, bool include_body)
{
    std::ifstream stream(file.path, std::ios::binary);
    if (!stream) {
        send_text(client, 500, "Internal Server Error");
        return;
    }
    client.send_all(http::serialize_response_head({200, "OK", http::resolve_mime_type(file.path), file.size}));
    if (!include_body) {
        return;
    }
    std::array<char, file_chunk_bytes> chunk{};
    while (stream) {
        stream.read(chunk.data(), static_cast<std::streamsize>(chunk.size()));
        const auto read = static_cast<std::size_t>(stream.gcount());
        if (read == 0) {
            break;
        }
        client.send_all(std::span<const char>(chunk.data(), read));
    }
}

void handle_request(const net::TcpSocket& client, const StaticSiteContext& context)
{
    const std::optional<std::string> header_block = receive_header_block(client);
    if (!header_block) {
        return;
    }
    const std::optional<http::HttpRequest> request = http::parse_http_request(*header_block);
    if (!request) {
        send_text(client, 400, "Bad Request");
        return;
    }
    if (std::ranges::find(context.allowed_hosts, request->host) == context.allowed_hosts.end()) {
        send_text(client, 403, "Forbidden");
        return;
    }
    const bool is_head = request->method == "HEAD";
    if (request->method != "GET" && !is_head) {
        send_text(client, 405, "Method Not Allowed");
        return;
    }
    const std::optional<std::string> path = http::decode_request_path(request->target);
    if (!path) {
        send_text(client, 400, "Bad Request");
        return;
    }
    const std::optional<ResolvedFile> file = resolve_file(context, *path);
    if (!file) {
        send_text(client, 404, "Not Found");
        return;
    }
    send_file(client, *file, !is_head);
}

}

StaticSiteContext create_static_site_context(const std::filesystem::path& root_directory, std::uint16_t port)
{
    return StaticSiteContext{
        std::filesystem::canonical(root_directory),
        {std::format("127.0.0.1:{}", port), std::format("localhost:{}", port)},
    };
}

void serve_static_site_connection(net::TcpSocket client, const StaticSiteContext& context)
{
    try {
        handle_request(client, context);
    }
    catch (const std::exception& error) {
        std::cerr << "request failed: " << error.what() << '\n';
    }
}

}
