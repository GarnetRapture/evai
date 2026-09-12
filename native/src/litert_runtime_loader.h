#pragma once

#include <filesystem>
#include <string>

namespace eversoul::native {

struct LiteRtRuntimeStatus {
    bool loaded = false;
    std::filesystem::path path;
    std::string architecture;
    std::string error;
};

[[nodiscard]] LiteRtRuntimeStatus loadLiteRtRuntime(
    const std::filesystem::path& configuredPath,
    const std::filesystem::path& executableDirectory,
    const std::filesystem::path& modelDirectory);
[[nodiscard]] LiteRtRuntimeStatus liteRtRuntimeStatus();
void unloadLiteRtRuntime();
[[nodiscard]] std::string nativeArchitecture();

}
