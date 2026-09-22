#include "api/asset_downloader.hpp"

#include <algorithm>
#include <array>
#include <charconv>
#include <cstdio>
#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <format>
#include <fstream>
#include <functional>
#include <iterator>
#include <memory>
#include <stdexcept>
#include <string>
#include <string_view>
#include <system_error>
#include <unordered_map>
#include <vector>

#if defined(_WIN32)
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#else
#include <sys/wait.h>
#endif

namespace evai::server::api
{

namespace
{

constexpr std::size_t download_worker_limit = 65535;
constexpr std::string_view manifest_repo_key = "repo";
constexpr std::string_view manifest_voice_key = "voice";
constexpr std::string_view manifest_files_key = "files";
constexpr std::string_view manifest_bytes_key = "bytes";
constexpr std::string_view manifest_list_files_key = "list_files";
constexpr std::string_view manifest_list_bytes_key = "list_bytes";
constexpr std::string_view source_magic = "EVAS1";
constexpr std::string_view source_key = "evai-local-asset-index";
constexpr std::string_view asset_scratch_name = "evai-assets.cache";
constexpr std::string_view asset_list_name = "evai-assets.list";

constexpr std::array<std::string_view, 10> excluded_directories{
    ".git",       ".xmake", "node_modules", "third_party",       "tmp",
    "tmp-claude", "tmp-codex", "dist",      "evai-assets.cache", "evai-database",
};

struct DirectoryMeasure
{
    std::size_t files;
    std::uint64_t bytes;
};

struct LocalIndex
{
    std::unordered_map<std::string, std::uint64_t> by_path;
    std::unordered_map<std::string, std::vector<std::string>> by_name;
};

std::string normalized(const std::filesystem::path &relative)
{
    std::string value = relative.generic_string();
    return value;
}

bool is_excluded(std::string_view name)
{
    return std::ranges::find(excluded_directories, name) != excluded_directories.end();
}

bool is_safe_relative(std::string_view path)
{
    if (path.empty() || path.front() == '/' || path.find("..") != std::string_view::npos)
    {
        return false;
    }
    return path.find(':') == std::string_view::npos;
}

bool voice_wanted(std::string_view path, app::VoiceLanguage voice)
{
    if (path.find("/voice/") == std::string_view::npos)
    {
        return true;
    }
    const bool korean = path.find("/ko/") != std::string_view::npos;
    const bool japanese = path.find("/ja/") != std::string_view::npos;
    if (!korean && !japanese)
    {
        return true;
    }
    switch (voice)
    {
    case app::VoiceLanguage::korean:
        return korean;
    case app::VoiceLanguage::japanese:
        return japanese;
    case app::VoiceLanguage::both:
        return true;
    case app::VoiceLanguage::none:
        break;
    }
    return false;
}

DirectoryMeasure measure_directory(const std::filesystem::path &directory)
{
    DirectoryMeasure measure{0, 0};
    std::error_code code;
    if (!std::filesystem::is_directory(directory, code))
    {
        return measure;
    }
    for (std::filesystem::recursive_directory_iterator iterator(
             directory, std::filesystem::directory_options::skip_permission_denied, code);
         iterator != std::filesystem::recursive_directory_iterator(); iterator.increment(code))
    {
        if (code)
        {
            break;
        }
        if (!iterator->is_regular_file(code) || code)
        {
            continue;
        }
        const std::uintmax_t size = iterator->file_size(code);
        if (code)
        {
            code.clear();
            continue;
        }
        ++measure.files;
        measure.bytes += static_cast<std::uint64_t>(size);
    }
    return measure;
}

DirectoryMeasure measure_asset_list(const std::filesystem::path &root)
{
    DirectoryMeasure measure{0, 0};
    for (const auto &file : {root / asset_list_name, root / "data" / "manifest.txt"})
    {
        std::ifstream stream(file, std::ios::binary);
        if (!stream)
        {
            continue;
        }
        std::string line;
        while (std::getline(stream, line))
        {
            if (!line.empty() && line.back() == '\r')
            {
                line.pop_back();
            }
            const auto tab = line.find('\t');
            if (tab == std::string::npos)
            {
                continue;
            }
            std::uint64_t size = 0;
            const char *begin = line.data() + tab + 1;
            const char *end = line.data() + line.size();
            if (std::from_chars(begin, end, size).ec != std::errc{})
            {
                continue;
            }
            ++measure.files;
            measure.bytes += size;
        }
        break;
    }
    return measure;
}

LocalIndex build_local_index(const std::filesystem::path &root)
{
    LocalIndex index;
    std::error_code code;
    for (std::filesystem::recursive_directory_iterator iterator(
             root, std::filesystem::directory_options::skip_permission_denied, code);
         iterator != std::filesystem::recursive_directory_iterator(); iterator.increment(code))
    {
        if (code)
        {
            break;
        }
        const std::filesystem::directory_entry &entry = *iterator;
        if (entry.is_directory(code) && !code)
        {
            if (is_excluded(entry.path().filename().string()))
            {
                iterator.disable_recursion_pending();
            }
            continue;
        }
        if (!entry.is_regular_file(code) || code)
        {
            code.clear();
            continue;
        }
        const std::uintmax_t size = entry.file_size(code);
        if (code)
        {
            code.clear();
            continue;
        }
        std::string relative = normalized(entry.path().lexically_relative(root));
        if (code || relative.empty())
        {
            code.clear();
            continue;
        }
        index.by_name[entry.path().filename().string()].push_back(relative);
        index.by_path.emplace(std::move(relative), static_cast<std::uint64_t>(size));
    }
    return index;
}

std::string_view suffix_of(std::string_view path)
{
    const auto separator = path.find('/');
    return separator == std::string_view::npos ? path : path.substr(separator + 1);
}

bool relocate_existing(const std::filesystem::path &root, LocalIndex &index, const AssetEntry &entry)
{
    const std::filesystem::path target_path(entry.path);
    const std::string name = target_path.filename().string();
    const auto candidates = index.by_name.find(name);
    if (candidates == index.by_name.end())
    {
        return false;
    }
    const std::string_view wanted = suffix_of(entry.path);
    for (const std::string &candidate : candidates->second)
    {
        if (candidate == entry.path || !candidate.ends_with(wanted))
        {
            continue;
        }
        const auto known = index.by_path.find(candidate);
        if (known == index.by_path.end() || (entry.size != 0 && known->second != entry.size))
        {
            continue;
        }
        const std::filesystem::path source = root / std::filesystem::path(candidate);
        const std::filesystem::path destination = root / target_path;
        std::error_code code;
        std::filesystem::create_directories(destination.parent_path(), code);
        code.clear();
        std::filesystem::rename(source, destination, code);
        if (code)
        {
            code.clear();
            std::filesystem::copy_file(source, destination, std::filesystem::copy_options::overwrite_existing, code);
            if (code)
            {
                continue;
            }
            std::filesystem::remove(source, code);
            code.clear();
        }
        index.by_path.erase(known);
        index.by_path.emplace(entry.path, entry.size);
        return true;
    }
    return false;
}

std::string read_all(const std::filesystem::path &file)
{
    std::ifstream stream(file, std::ios::binary);
    if (!stream)
    {
        return {};
    }
    return std::string(std::istreambuf_iterator<char>(stream), std::istreambuf_iterator<char>());
}

std::string parse_value(std::string_view body, std::string_view key)
{
    for (std::size_t start = 0; start < body.size();)
    {
        const auto end = body.find('\n', start);
        std::string_view line = body.substr(start, end == std::string_view::npos ? body.size() - start : end - start);
        start = end == std::string_view::npos ? body.size() : end + 1;
        const auto separator = line.find('=');
        if (separator == std::string_view::npos)
        {
            continue;
        }
        std::string_view name = line.substr(0, separator);
        while (!name.empty() && (name.back() == ' ' || name.back() == '\t'))
        {
            name.remove_suffix(1);
        }
        while (!name.empty() && (name.front() == ' ' || name.front() == '\t'))
        {
            name.remove_prefix(1);
        }
        if (name != key)
        {
            continue;
        }
        std::string_view value = line.substr(separator + 1);
        while (!value.empty() && (value.front() == ' ' || value.front() == '\t'))
        {
            value.remove_prefix(1);
        }
        while (!value.empty() && (value.back() == ' ' || value.back() == '\t' || value.back() == '\r'))
        {
            value.remove_suffix(1);
        }
        return std::string(value);
    }
    return {};
}

std::string read_manifest_value(const std::filesystem::path &file, std::string_view key)
{
    return parse_value(read_all(file), key);
}

std::string decode_source_file(const std::filesystem::path &file)
{
    const std::string raw = read_all(file);
    if (!raw.starts_with(source_magic))
    {
        return raw;
    }
    std::string decoded;
    decoded.reserve(raw.size() - source_magic.size());
    for (std::size_t index = source_magic.size(); index < raw.size(); ++index)
    {
        const std::size_t offset = index - source_magic.size();
        const auto key = static_cast<unsigned char>(source_key[offset % source_key.size()]);
        const auto mask = static_cast<unsigned char>(key ^ static_cast<unsigned char>(offset * 31u + 7u));
        decoded.push_back(static_cast<char>(static_cast<unsigned char>(raw[index]) ^ mask));
    }
    return decoded;
}

std::string source_value(std::string_view body, std::string_view key)
{
    return parse_value(body, key);
}

std::string encode_path(std::string_view value)
{
    std::string encoded;
    encoded.reserve(value.size());
    for (const unsigned char character : value)
    {
        const bool plain = (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z') ||
                           (character >= '0' && character <= '9') || character == '/' || character == '-' ||
                           character == '_' || character == '.' || character == '~';
        if (plain)
        {
            encoded.push_back(static_cast<char>(character));
            continue;
        }
        encoded += std::format("%{:02X}", static_cast<unsigned>(character));
    }
    return encoded;
}

std::string expand_target(std::string_view pattern, const AssetSource &source, std::string_view path)
{
    std::string expanded;
    expanded.reserve(pattern.size() + path.size());
    for (std::size_t index = 0; index < pattern.size();)
    {
        if (pattern[index] != '{')
        {
            expanded.push_back(pattern[index]);
            ++index;
            continue;
        }
        const auto close = pattern.find('}', index + 1);
        if (close == std::string_view::npos)
        {
            expanded.append(pattern.substr(index));
            break;
        }
        const std::string_view token = pattern.substr(index + 1, close - index - 1);
        if (token == "repo")
        {
            expanded.append(source.repo);
        }
        else if (token == "branch")
        {
            expanded.append(source.branch);
        }
        else if (token == "path")
        {
            expanded.append(path);
        }
        index = close + 1;
    }
    return expanded;
}

std::string config_quote(std::string_view value)
{
    std::string quoted = "\"";
    for (const char character : value)
    {
        switch (character)
        {
        case '\\': quoted += "\\\\"; break;
        case '"': quoted += "\\\""; break;
        case '\n': quoted += "\\n"; break;
        case '\r': quoted += "\\r"; break;
        case '\t': quoted += "\\t"; break;
        default: quoted.push_back(character); break;
        }
    }
    return quoted + '"';
}

#if defined(_WIN32)
struct HandleCloser
{
    void operator()(void *handle) const { CloseHandle(handle); }
};
using OwnedHandle = std::unique_ptr<void, HandleCloser>;
#endif

int run_curl(const std::filesystem::path &config, const std::function<void(std::string_view)> &on_line,
             std::string &error)
{
    std::string pending;
    const auto consume = [&](std::string_view chunk) {
        pending.append(chunk);
        for (auto end = pending.find('\n'); end != std::string::npos; end = pending.find('\n'))
        {
            on_line(std::string_view(pending).substr(0, end));
            pending.erase(0, end + 1);
        }
    };
#if defined(_WIN32)
    SECURITY_ATTRIBUTES attributes{sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE};
    HANDLE raw_read = nullptr;
    HANDLE raw_write = nullptr;
    if (!CreatePipe(&raw_read, &raw_write, &attributes, 0))
    {
        error = std::format("curl pipe: {}", GetLastError());
        return -1;
    }
    OwnedHandle reader(raw_read);
    OwnedHandle writer(raw_write);
    if (!SetHandleInformation(reader.get(), HANDLE_FLAG_INHERIT, 0))
    {
        error = std::format("curl pipe inheritance: {}", GetLastError());
        return -1;
    }
    std::wstring command = L"curl.exe -q --config \"" + config.wstring() + L"\"";
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    startup.dwFlags = STARTF_USESTDHANDLES;
    startup.hStdOutput = writer.get();
    startup.hStdError = writer.get();
    PROCESS_INFORMATION process{};
    if (!CreateProcessW(nullptr, command.data(), nullptr, nullptr, TRUE, CREATE_NO_WINDOW, nullptr, nullptr,
                        &startup, &process))
    {
        error = std::format("curl launch: {}", GetLastError());
        return -1;
    }
    OwnedHandle process_handle(process.hProcess);
    OwnedHandle thread_handle(process.hThread);
    writer.reset();
    std::array<char, 4096> buffer{};
    DWORD count = 0;
    while (ReadFile(reader.get(), buffer.data(), static_cast<DWORD>(buffer.size()), &count, nullptr) && count != 0)
    {
        consume(std::string_view(buffer.data(), count));
    }
    const DWORD pipe_error = GetLastError();
    if (count == 0 && pipe_error != ERROR_BROKEN_PIPE && pipe_error != ERROR_SUCCESS)
    {
        error = std::format("curl output: {}", pipe_error);
    }
    if (WaitForSingleObject(process_handle.get(), INFINITE) != WAIT_OBJECT_0)
    {
        error += std::format("curl wait: {}", GetLastError());
        return -1;
    }
    DWORD status = 0;
    if (!GetExitCodeProcess(process_handle.get(), &status))
    {
        error += std::format("curl exit status: {}", GetLastError());
        return -1;
    }
#else
    std::string quoted = "'";
    for (const char character : config.string())
    {
        quoted += character == '\'' ? "'\\''" : std::string(1, character);
    }
    quoted += '\'';
    const std::string command = "curl -q --config " + quoted;
    FILE *pipe = popen(command.c_str(), "r");
    if (pipe == nullptr)
    {
        error = "curl launch failed";
        return -1;
    }
    std::array<char, 4096> buffer{};
    while (std::fgets(buffer.data(), static_cast<int>(buffer.size()), pipe) != nullptr)
    {
        consume(buffer.data());
    }
    const bool read_failed = std::ferror(pipe) != 0;
    const int process_status = pclose(pipe);
    if (read_failed || process_status == -1 || !WIFEXITED(process_status))
    {
        error = "curl process or output failed";
        return -1;
    }
    const int status = WEXITSTATUS(process_status);
#endif
    if (!pending.empty())
    {
        consume("\n");
    }
    return static_cast<int>(status);
}

void write_curl_transfer(std::ostream &stream, const AssetSource &source, std::string_view target,
                         const std::filesystem::path &output, bool resume)
{
    stream << "silent\nshow-error\nfail\nlocation\ngloboff\nno-buffer\n"
              "proto = \"=https\"\nproto-redir = \"=https\"\n"
              "retry = 3\nconnect-timeout = 15\nspeed-time = 120\nspeed-limit = 1\n";
    if (resume)
    {
        stream << "continue-at = \"-\"\n";
    }
    stream << "url = " << config_quote(std::format("https://{}{}", source.host, target)) << '\n'
           << "output = " << config_quote(output.generic_string()) << '\n';
}

std::vector<AssetEntry> parse_asset_list(const std::filesystem::path &file)
{
    std::ifstream stream(file, std::ios::binary);
    if (!stream)
    {
        throw std::runtime_error("cannot read asset list: " + file.string());
    }
    std::vector<AssetEntry> entries;
    std::string line;
    std::size_t number = 0;
    while (std::getline(stream, line))
    {
        ++number;
        if (!line.empty() && line.back() == '\r')
        {
            line.pop_back();
        }
        const auto tab = line.find('\t');
        std::uint64_t size = 0;
        const char *end = line.data() + line.size();
        const char *begin = tab == std::string::npos ? end : line.data() + tab + 1;
        const auto parsed = std::from_chars(begin, end, size);
        const std::string path = line.substr(0, tab);
        if (parsed.ec != std::errc{} || parsed.ptr != end || !is_safe_relative(path) ||
            path.find('\\') != std::string::npos || !path.starts_with("data/"))
        {
            throw std::runtime_error(std::format("invalid asset list {} line {}", file.string(), number));
        }
        entries.push_back({path, size});
    }
    if (stream.bad() || entries.empty())
    {
        throw std::runtime_error("empty or unreadable asset list: " + file.string());
    }
    return entries;
}

std::filesystem::path fetch_remote_list(const std::filesystem::path &root, const AssetSource &source)
{
    const auto scratch = std::filesystem::absolute(root / asset_scratch_name);
    std::filesystem::create_directories(scratch);
    const auto config = scratch / "list.curl";
    const auto body = scratch / "manifest.txt";
    const auto diagnostics = scratch / "list.stderr";
    {
        std::ofstream stream(config, std::ios::trunc);
        stream << "stderr = " << config_quote(diagnostics.generic_string()) << '\n';
        write_curl_transfer(stream, source, expand_target(source.list_path, source, {}), body, false);
        stream.close();
        if (!stream)
        {
            throw std::runtime_error("cannot write curl configuration: " + config.string());
        }
    }
    std::string error;
    const int status = run_curl(config, [](std::string_view) {}, error);
    if (status != 0 || !error.empty())
    {
        throw std::runtime_error(std::format("asset list: curl exit {}: {}{}", status, error, read_all(diagnostics)));
    }
    return body;
}

std::vector<AssetEntry> load_asset_list(const std::filesystem::path &root, const AssetSource &source)
{
    for (const auto &file : {root / asset_list_name, root / "data" / "manifest.txt"})
    {
        if (std::filesystem::is_regular_file(file))
        {
            return parse_asset_list(file);
        }
    }
    const auto body = fetch_remote_list(root, source);
    auto entries = parse_asset_list(body);
    std::filesystem::copy_file(body, root / asset_list_name, std::filesystem::copy_options::overwrite_existing);
    return entries;
}

} // namespace

AssetSource read_asset_source(const std::filesystem::path &root)
{
    const std::filesystem::path encoded = root / std::filesystem::path(asset_source_encoded_name);
    const std::filesystem::path plain = root / std::filesystem::path(asset_source_name);
    const std::string body =
        std::filesystem::is_regular_file(encoded) ? decode_source_file(encoded) : decode_source_file(plain);
    AssetSource source{source_value(body, "host"),  source_value(body, "repo"), source_value(body, "branch"),
                       source_value(body, "list"), source_value(body, "file"), source_value(body, "prefix")};
    if (source.branch.empty())
    {
        source.branch = "main";
    }
    return source;
}

bool refresh_asset_list(const std::filesystem::path &root, const AssetSource &source, std::string &error)
{
    try
    {
        const std::filesystem::path body = fetch_remote_list(root, source);
        parse_asset_list(body);
        std::filesystem::copy_file(body, root / std::filesystem::path(asset_list_name),
                                   std::filesystem::copy_options::overwrite_existing);
        return true;
    }
    catch (const std::exception &failure)
    {
        error = failure.what();
        return false;
    }
}

bool asset_manifest_satisfied(const std::filesystem::path &root, const AssetSource &source, app::VoiceLanguage voice)
{
    const std::filesystem::path manifest = root / std::filesystem::path(asset_manifest_name);
    if (!std::filesystem::is_regular_file(manifest))
    {
        return false;
    }
    if (read_manifest_value(manifest, manifest_repo_key) != source.repo)
    {
        return false;
    }
    if (read_manifest_value(manifest, manifest_voice_key) != app::voice_code(voice))
    {
        return false;
    }
    const DirectoryMeasure listed = measure_asset_list(root);
    if (listed.files == 0)
    {
        return false;
    }
    if (read_manifest_value(manifest, manifest_list_files_key) != std::format("{}", listed.files) ||
        read_manifest_value(manifest, manifest_list_bytes_key) != std::format("{}", listed.bytes))
    {
        return false;
    }
    const DirectoryMeasure measure = measure_directory(root / std::filesystem::path(asset_root_name));
    if (measure.files == 0)
    {
        return false;
    }
    return read_manifest_value(manifest, manifest_files_key) == std::format("{}", measure.files) &&
           read_manifest_value(manifest, manifest_bytes_key) == std::format("{}", measure.bytes);
}

void store_asset_manifest(const std::filesystem::path &root, const AssetSource &source, app::VoiceLanguage voice)
{
    const DirectoryMeasure measure = measure_directory(root / std::filesystem::path(asset_root_name));
    const DirectoryMeasure listed = measure_asset_list(root);
    std::ofstream stream(root / std::filesystem::path(asset_manifest_name), std::ios::trunc);
    if (!stream)
    {
        return;
    }
    stream << manifest_repo_key << " = " << source.repo << '\n'
           << manifest_voice_key << " = " << app::voice_code(voice) << '\n'
           << manifest_files_key << " = " << measure.files << '\n'
           << manifest_bytes_key << " = " << measure.bytes << '\n'
           << manifest_list_files_key << " = " << listed.files << '\n'
           << manifest_list_bytes_key << " = " << listed.bytes << '\n';
}

AssetPlan plan_assets(const std::filesystem::path &root, const AssetSource &source, app::VoiceLanguage voice)
{
    AssetPlan plan{{}, 0, 0, 0, {}};
    std::vector<AssetEntry> remote;
    try
    {
        remote = load_asset_list(root, source);
    }
    catch (const std::exception &error)
    {
        plan.error = error.what();
    }
    if (!plan.error.empty())
    {
        return plan;
    }
    LocalIndex index = build_local_index(root);
    for (const AssetEntry &entry : remote)
    {
        if (!is_safe_relative(entry.path) || !voice_wanted(entry.path, voice))
        {
            continue;
        }
        if (!source.prefix.empty() && !entry.path.starts_with(source.prefix))
        {
            continue;
        }
        const auto known = index.by_path.find(entry.path);
        if (known != index.by_path.end() && (entry.size == 0 || known->second == entry.size))
        {
            ++plan.present;
            continue;
        }
        if (known == index.by_path.end() && relocate_existing(root, index, entry))
        {
            ++plan.relocated;
            continue;
        }
        const auto staged = index.by_path.find(entry.path + ".part");
        const std::uint64_t carried = staged != index.by_path.end() ? staged->second : 0;
        plan.pending.push_back(entry);
        plan.pending_bytes += entry.size > carried ? entry.size - carried : 0;
    }
    return plan;
}

AssetOutcome fetch_assets(const std::filesystem::path &root, const AssetSource &source, const AssetPlan &plan,
                          const AssetReporter &report)
{
    AssetOutcome outcome{0, 0, 0, {}};
    if (plan.pending.empty())
    {
        return outcome;
    }
    std::vector<bool> completed(plan.pending.size(), false);
    try
    {
        const auto scratch = std::filesystem::absolute(root / asset_scratch_name);
        std::filesystem::create_directories(scratch);
        const auto config = scratch / "download.curl";
        const auto diagnostics = scratch / "download.stderr";
        std::vector<std::uint64_t> carried(plan.pending.size(), 0);
        std::ofstream stream(config, std::ios::trunc);
        stream << "parallel\nparallel-max = " << std::min(download_worker_limit, plan.pending.size()) << '\n'
               << "stderr = " << config_quote(diagnostics.generic_string()) << '\n';
        for (std::size_t index = 0; index < plan.pending.size(); ++index)
        {
            const auto &entry = plan.pending[index];
            auto staging = std::filesystem::absolute(root / entry.path);
            staging += ".part";
            std::filesystem::create_directories(staging.parent_path());
            if (std::filesystem::exists(staging))
            {
                const auto size = std::filesystem::file_size(staging);
                if (size < entry.size)
                {
                    carried[index] = size;
                }
                else
                {
                    std::filesystem::remove(staging);
                }
            }
            if (index != 0)
            {
                stream << "next\n";
            }
            write_curl_transfer(stream, source, expand_target(source.file_path, source, encode_path(entry.path)),
                                staging, carried[index] != 0);
            stream << "write-out = \"%{urlnum}\\t%{exitcode}\\t%{errormsg}\\n\"\n";
        }
        stream.close();
        if (!stream)
        {
            throw std::runtime_error("cannot write curl configuration: " + config.string());
        }
        AssetProgress progress{0, plan.pending.size(), 0, plan.pending_bytes, {}};
        if (report)
        {
            report(progress);
        }
        std::string process_error;
        const int status = run_curl(config, [&](std::string_view line) {
            const auto first = line.find('\t');
            const auto second = first == std::string_view::npos ? first : line.find('\t', first + 1);
            if (second == std::string_view::npos)
            {
                outcome.error += std::format("curl output: {}\n", line);
                return;
            }
            std::size_t index = 0;
            int transfer_status = 0;
            const auto parsed_index = std::from_chars(line.data(), line.data() + first, index);
            const auto parsed_status = std::from_chars(line.data() + first + 1, line.data() + second, transfer_status);
            if (parsed_index.ec != std::errc{} || parsed_index.ptr != line.data() + first ||
                parsed_status.ec != std::errc{} || parsed_status.ptr != line.data() + second ||
                index >= plan.pending.size() || completed[index])
            {
                outcome.error += std::format("invalid curl result: {}\n", line);
                return;
            }
            completed[index] = true;
            const auto &entry = plan.pending[index];
            const auto destination = root / entry.path;
            auto staging = destination;
            staging += ".part";
            std::error_code code;
            const auto received = std::filesystem::file_size(staging, code);
            const auto written = !code && received > carried[index] ? received - carried[index] : 0;
            progress.bytes += written;
            if (transfer_status != 0 || code || received != entry.size)
            {
                ++outcome.failed;
                outcome.error += std::format("{}: curl {}, {}; {}\n", entry.path, transfer_status,
                                             line.substr(second + 1),
                                             code ? code.message() : std::format("size {} expected {}", received, entry.size));
            }
            else
            {
                std::filesystem::remove(destination, code);
                if (!code)
                {
                    std::filesystem::rename(staging, destination, code);
                }
                if (code)
                {
                    ++outcome.failed;
                    outcome.error += std::format("{}: {}\n", entry.path, code.message());
                }
                else
                {
                    ++outcome.downloaded;
                    outcome.bytes += written;
                }
            }
            ++progress.completed;
            progress.current = entry.path;
            if (report)
            {
                report(progress);
            }
        }, process_error);
        if (status != 0 || !process_error.empty())
        {
            outcome.error += std::format("curl exit {}: {}{}\n", status, process_error, read_all(diagnostics));
        }
    }
    catch (const std::exception &error)
    {
        outcome.error += error.what();
    }
    const auto missing = static_cast<std::size_t>(std::ranges::count(completed, false));
    if (missing != 0)
    {
        outcome.failed += missing;
        outcome.error += std::format("\ncurl did not complete {} transfers", missing);
    }
    return outcome;
}

} // namespace evai::server::api
