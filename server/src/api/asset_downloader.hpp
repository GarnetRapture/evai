#pragma once

#include "app/server_config.hpp"

#include <cstdint>
#include <filesystem>
#include <functional>
#include <string>
#include <string_view>
#include <vector>

namespace evai::server::api {

inline constexpr std::string_view asset_root_name = "data";
inline constexpr std::string_view asset_manifest_name = "evai-assets.manifest";
inline constexpr std::string_view asset_source_name = "evai-assets.sources";
inline constexpr std::string_view asset_source_encoded_name = "evai-assets.bin";

struct AssetSource {
    std::string host;
    std::string repo;
    std::string branch;
    std::string list_path;
    std::string file_path;
    std::string prefix;
};

struct AssetEntry {
    std::string path;
    std::uint64_t size;
};

struct AssetPlan {
    std::vector<AssetEntry> pending;
    std::uint64_t pending_bytes;
    std::size_t present;
    std::size_t relocated;
    std::string error;
};

struct AssetProgress {
    std::size_t completed;
    std::size_t total;
    std::uint64_t bytes;
    std::uint64_t total_bytes;
    std::string current;
};

struct AssetOutcome {
    std::size_t downloaded;
    std::size_t failed;
    std::uint64_t bytes;
    std::string error;
};

using AssetReporter = std::function<void(const AssetProgress&)>;

[[nodiscard]] AssetSource read_asset_source(const std::filesystem::path& root);
[[nodiscard]] bool refresh_asset_list(const std::filesystem::path& root, const AssetSource& source, std::string& error);
[[nodiscard]] bool asset_manifest_satisfied(const std::filesystem::path& root, const AssetSource& source, app::VoiceLanguage voice);
void store_asset_manifest(const std::filesystem::path& root, const AssetSource& source, app::VoiceLanguage voice);
[[nodiscard]] AssetPlan plan_assets(const std::filesystem::path& root, const AssetSource& source, app::VoiceLanguage voice);
[[nodiscard]] AssetOutcome fetch_assets(const std::filesystem::path& root, const AssetSource& source, const AssetPlan& plan, const AssetReporter& report);

}
