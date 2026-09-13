#pragma once

#include <filesystem>
#include <string_view>

namespace evai::server::http {

[[nodiscard]] std::string_view resolve_mime_type(const std::filesystem::path& file);

}
