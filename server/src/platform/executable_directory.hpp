#pragma once

#include <filesystem>

namespace evai::server::platform {

[[nodiscard]] std::filesystem::path resolve_executable_directory();
[[nodiscard]] bool owns_console_window();
void apply_console_identity();
void wait_for_console_close();

}
