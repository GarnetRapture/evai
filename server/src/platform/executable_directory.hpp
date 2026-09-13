#pragma once

#include <filesystem>

namespace evai::server::platform {

[[nodiscard]] std::filesystem::path resolve_executable_directory();

}
