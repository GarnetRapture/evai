#include "site/static_site.hpp"

#include "http/http_response.hpp"
#include "http/http_writer.hpp"
#include "http/mime_type.hpp"
#include "net/tcp_socket.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <system_error>

namespace evai::server::site {

namespace {

constexpr std::string_view index_file_name = "index.html";
constexpr std::size_t file_chunk_bytes = 64 * 1024;

struct ResolvedFile {
    std::filesystem::path path;
    std::uintmax_t size;
};

bool is_within(const std::filesystem::path& root, const std::filesystem::path& candidate)
{
    return std::mismatch(root.begin(), root.end(), candidate.begin(), candidate.end()).first == root.end();
}

std::optional<ResolvedFile> resolve_file(const StaticSiteContext& context, std::string_view request_path)
{
    std::filesystem::path relative = std::filesystem::path(std::u8string(request_path.begin(), request_path.end())).relative_path();
    std::error_code error;
    std::filesystem::path candidate = std::filesystem::weakly_canonical(context.root_directory / relative, error);
    if (error || !is_within(context.root_directory, candidate)) {
        return std::nullopt;
    }
    if (!context.hidden_directory.empty() && is_within(context.hidden_directory, candidate)) {
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
        http::send_status_text(client, 500, "Internal Server Error");
        return;
    }
    client.send_all(http::serialize_response_head({200, "OK", http::resolve_mime_type(file.path), file.size, {}}));
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

}

StaticSiteContext create_static_site_context(const std::filesystem::path& root_directory, const std::filesystem::path& hidden_directory)
{
    std::error_code error;
    const std::filesystem::path hidden = hidden_directory.empty() ? std::filesystem::path{} : std::filesystem::weakly_canonical(hidden_directory, error);
    return StaticSiteContext{std::filesystem::canonical(root_directory), error ? std::filesystem::path{} : hidden};
}

void serve_static_file(const net::TcpSocket& client, const StaticSiteContext& context, std::string_view request_path, bool include_body)
{
    const std::optional<ResolvedFile> file = resolve_file(context, request_path);
    if (!file) {
        http::send_status_text(client, 404, "Not Found");
        return;
    }
    send_file(client, *file, include_body);
}

}
