#include "http/mime_type.hpp"

#include <algorithm>
#include <array>
#include <cctype>
#include <filesystem>
#include <string>
#include <string_view>
#include <utility>

namespace evai::server::http {

namespace {

constexpr std::string_view default_mime_type = "application/octet-stream";

constexpr std::array<std::pair<std::string_view, std::string_view>, 28> mime_types{{
    {".html", "text/html; charset=utf-8"},
    {".htm", "text/html; charset=utf-8"},
    {".js", "text/javascript; charset=utf-8"},
    {".mjs", "text/javascript; charset=utf-8"},
    {".css", "text/css; charset=utf-8"},
    {".json", "application/json; charset=utf-8"},
    {".map", "application/json; charset=utf-8"},
    {".webmanifest", "application/manifest+json; charset=utf-8"},
    {".txt", "text/plain; charset=utf-8"},
    {".md", "text/markdown; charset=utf-8"},
    {".wasm", "application/wasm"},
    {".svg", "image/svg+xml"},
    {".png", "image/png"},
    {".jpg", "image/jpeg"},
    {".jpeg", "image/jpeg"},
    {".gif", "image/gif"},
    {".webp", "image/webp"},
    {".avif", "image/avif"},
    {".ico", "image/x-icon"},
    {".woff", "font/woff"},
    {".woff2", "font/woff2"},
    {".ttf", "font/ttf"},
    {".otf", "font/otf"},
    {".mp3", "audio/mpeg"},
    {".ogg", "audio/ogg"},
    {".wav", "audio/wav"},
    {".mp4", "video/mp4"},
    {".webm", "video/webm"},
}};

}

std::string_view resolve_mime_type(const std::filesystem::path& file)
{
    std::string extension = file.extension().string();
    std::ranges::transform(extension, extension.begin(), [](unsigned char character) { return static_cast<char>(std::tolower(character)); });
    const auto match = std::ranges::find(mime_types, std::string_view(extension), &std::pair<std::string_view, std::string_view>::first);
    return match == mime_types.end() ? default_mime_type : match->second;
}

}
