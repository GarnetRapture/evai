#pragma once

#include <filesystem>
#include <map>
#include <string>
#include <string_view>

namespace eversoul::native {

using NativeSettings = std::map<std::string, std::string, std::less<>>;

[[nodiscard]] NativeSettings readNativeSettings(const std::filesystem::path& path);
void updateNativeSettings(const std::filesystem::path& path, const NativeSettings& updates);

}
