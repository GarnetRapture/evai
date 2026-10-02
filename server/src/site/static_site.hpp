#pragma once

#include "http/http_writer.hpp"

#include <filesystem>
#include <string_view>

namespace evai::server::site {

struct StaticSiteContext {
    std::filesystem::path root_directory;
    std::filesystem::path hidden_directory;
};

[[nodiscard]] StaticSiteContext create_static_site_context(const std::filesystem::path& root_directory, const std::filesystem::path& hidden_directory);

void serve_static_file(const http::HttpChannel& channel, const StaticSiteContext& context, std::string_view request_path, bool include_body);

}
