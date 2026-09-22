#include "api/asset_downloader.hpp"

#include "storage/sqlite_database.hpp"

#include <algorithm>
#include <array>
#include <atomic>
#include <cctype>
#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <format>
#include <fstream>
#include <functional>
#include <iterator>
#include <mutex>
#include <string>
#include <string_view>
#include <system_error>
#include <thread>
#include <unordered_map>
#include <vector>

#if defined(_WIN32)
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <winhttp.h>
#endif

namespace evai::server::api
{

namespace
{

constexpr std::size_t download_worker_limit = 8;
constexpr int download_attempt_limit = 3;
constexpr std::string_view manifest_repo_key = "repo";
constexpr std::string_view manifest_voice_key = "voice";
constexpr std::string_view manifest_files_key = "files";
constexpr std::string_view manifest_bytes_key = "bytes";
constexpr std::string_view source_magic = "EVAS1";
constexpr std::string_view source_key = "evai-local-asset-index";
constexpr std::string_view asset_scratch_name = ".evai-assets-tmp";

constexpr std::array<std::string_view, 8> excluded_directories{
    ".git", ".xmake", "node_modules", "third_party", "tmp", "tmp-claude", "dist", "evai-database",
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
        std::string relative = normalized(std::filesystem::relative(entry.path(), root, code));
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

storage::SqliteDatabase &json_engine()
{
    static storage::SqliteDatabase engine(std::filesystem::path(":memory:"));
    return engine;
}

void parse_tree_page(std::string_view body, std::vector<AssetEntry> &entries)
{
    storage::SqliteStatement statement = json_engine().prepare(
        "SELECT json_extract(value, '$.path'), json_extract(value, '$.size') FROM json_each(?1)"
        " WHERE json_extract(value, '$.type') = 'file'");
    statement.bind_text(1, body);
    while (statement.step())
    {
        if (statement.column_is_null(0))
        {
            continue;
        }
        const std::int64_t size = statement.column_is_null(1) ? 0 : statement.column_integer(1);
        entries.push_back({statement.column_text(0), size < 0 ? 0 : static_cast<std::uint64_t>(size)});
    }
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

std::string next_page_target(std::string_view link)
{
    if (link.find("rel=\"next\"") == std::string_view::npos)
    {
        return {};
    }
    const auto start = link.find('<');
    const auto end = link.find('>', start == std::string_view::npos ? 0 : start + 1);
    if (start == std::string_view::npos || end == std::string_view::npos)
    {
        return {};
    }
    const std::string_view url = link.substr(start + 1, end - start - 1);
    const auto scheme = url.find("//");
    if (scheme == std::string_view::npos)
    {
        return std::string(url);
    }
    const auto path = url.find('/', scheme + 2);
    if (path == std::string_view::npos)
    {
        return std::string(url);
    }
    return std::string(url.substr(path));
}

#if defined(_WIN32)

class InternetHandle
{
public:
    InternetHandle() = default;
    explicit InternetHandle(HINTERNET handle) : handle_(handle) {}
    ~InternetHandle()
    {
        if (handle_ != nullptr)
        {
            WinHttpCloseHandle(handle_);
        }
    }
    InternetHandle(const InternetHandle &) = delete;
    InternetHandle &operator=(const InternetHandle &) = delete;
    InternetHandle(InternetHandle &&other) noexcept : handle_(other.handle_) { other.handle_ = nullptr; }
    InternetHandle &operator=(InternetHandle &&other) noexcept
    {
        if (this != &other)
        {
            if (handle_ != nullptr)
            {
                WinHttpCloseHandle(handle_);
            }
            handle_ = other.handle_;
            other.handle_ = nullptr;
        }
        return *this;
    }

    [[nodiscard]] HINTERNET get() const { return handle_; }
    explicit operator bool() const { return handle_ != nullptr; }

private:
    HINTERNET handle_ = nullptr;
};

std::wstring widen(std::string_view value)
{
    if (value.empty())
    {
        return {};
    }
    const int length = MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0);
    std::wstring wide(static_cast<std::size_t>(length), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), wide.data(), length);
    return wide;
}

std::string narrow(std::wstring_view value)
{
    if (value.empty())
    {
        return {};
    }
    const int length =
        WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
    std::string narrowed(static_cast<std::size_t>(length), '\0');
    WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), narrowed.data(), length, nullptr,
                        nullptr);
    return narrowed;
}

struct Response
{
    bool transferred;
    DWORD status;
    std::string link;
    std::string error;
};

std::string describe_error(std::string_view stage)
{
    return std::format("{} failed ({})", stage, GetLastError());
}

std::string query_link_header(HINTERNET request)
{
    DWORD length = 0;
    WinHttpQueryHeaders(request, WINHTTP_QUERY_CUSTOM, L"Link", WINHTTP_NO_OUTPUT_BUFFER, &length,
                        WINHTTP_NO_HEADER_INDEX);
    if (GetLastError() != ERROR_INSUFFICIENT_BUFFER || length == 0)
    {
        return {};
    }
    std::wstring buffer(length / sizeof(wchar_t), L'\0');
    if (!WinHttpQueryHeaders(request, WINHTTP_QUERY_CUSTOM, L"Link", buffer.data(), &length, WINHTTP_NO_HEADER_INDEX))
    {
        return {};
    }
    buffer.resize(length / sizeof(wchar_t));
    while (!buffer.empty() && buffer.back() == L'\0')
    {
        buffer.pop_back();
    }
    return narrow(buffer);
}

Response send_request(HINTERNET connect, std::wstring_view target, std::uint64_t range_start,
                      const std::function<bool(DWORD)> &on_headers,
                      const std::function<bool(const char *, DWORD)> &sink)
{
    Response response{false, 0, {}, {}};
    const std::wstring path(target);
    InternetHandle request(WinHttpOpenRequest(connect, L"GET", path.c_str(), nullptr, WINHTTP_NO_REFERER,
                                              WINHTTP_DEFAULT_ACCEPT_TYPES, WINHTTP_FLAG_SECURE));
    if (!request)
    {
        response.error = describe_error("open request");
        return response;
    }
    const std::wstring headers = range_start > 0 ? widen(std::format("Range: bytes={}-", range_start)) : std::wstring();
    if (!WinHttpSendRequest(request.get(), headers.empty() ? WINHTTP_NO_ADDITIONAL_HEADERS : headers.c_str(),
                            headers.empty() ? 0 : static_cast<DWORD>(-1), WINHTTP_NO_REQUEST_DATA, 0, 0, 0))
    {
        response.error = describe_error("send request");
        return response;
    }
    if (!WinHttpReceiveResponse(request.get(), nullptr))
    {
        response.error = describe_error("receive response");
        return response;
    }
    DWORD status = 0;
    DWORD status_size = sizeof(status);
    if (!WinHttpQueryHeaders(request.get(), WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                             WINHTTP_HEADER_NAME_BY_INDEX, &status, &status_size, WINHTTP_NO_HEADER_INDEX))
    {
        response.error = describe_error("query status");
        return response;
    }
    response.status = status;
    if (status != 200 && status != 206)
    {
        response.error = std::format("http status {}", status);
        return response;
    }
    response.link = query_link_header(request.get());
    if (on_headers && !on_headers(status))
    {
        response.error = "cannot open destination";
        return response;
    }
    for (;;)
    {
        DWORD available = 0;
        if (!WinHttpQueryDataAvailable(request.get(), &available))
        {
            response.error = describe_error("query data");
            return response;
        }
        if (available == 0)
        {
            break;
        }
        std::vector<char> chunk(available);
        DWORD read = 0;
        if (!WinHttpReadData(request.get(), chunk.data(), available, &read))
        {
            response.error = describe_error("read data");
            return response;
        }
        if (read == 0)
        {
            break;
        }
        if (!sink(chunk.data(), read))
        {
            response.error = "write failed";
            return response;
        }
    }
    response.transferred = true;
    return response;
}

InternetHandle open_session()
{
    InternetHandle session(WinHttpOpen(L"evai-server", WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, WINHTTP_NO_PROXY_NAME,
                                       WINHTTP_NO_PROXY_BYPASS, 0));
    if (session)
    {
        WinHttpSetTimeouts(session.get(), 15000, 15000, 30000, 120000);
    }
    return session;
}

InternetHandle open_connection(HINTERNET session, std::string_view host)
{
    return InternetHandle(WinHttpConnect(session, widen(host).c_str(), INTERNET_DEFAULT_HTTPS_PORT, 0));
}

std::vector<AssetEntry> load_remote_tree(HINTERNET connect, const AssetSource &source, std::string &error)
{
    std::vector<AssetEntry> entries;
    std::string target = expand_target(source.index_path, source, {});
    while (!target.empty())
    {
        std::string body;
        const Response response = send_request(connect, widen(target), 0, nullptr,
                                               [&body](const char *data, DWORD size) {
                                                   body.append(data, size);
                                                   return true;
                                               });
        if (!response.transferred)
        {
            error = std::format("asset index: {}", response.error);
            return {};
        }
        parse_tree_page(body, entries);
        target = next_page_target(response.link);
    }
    return entries;
}

bool download_entry(HINTERNET connect, const AssetSource &source, const AssetEntry &entry,
                    const std::filesystem::path &destination, std::uint64_t &written, std::string &error)
{
    std::error_code code;
    std::filesystem::create_directories(destination.parent_path(), code);
    code.clear();
    std::filesystem::path staging = destination;
    staging += ".part";
    std::uint64_t resume = 0;
    const std::uintmax_t partial = std::filesystem::file_size(staging, code);
    if (!code && (entry.size == 0 || static_cast<std::uint64_t>(partial) < entry.size))
    {
        resume = static_cast<std::uint64_t>(partial);
    }
    code.clear();
    std::ofstream stream;
    std::uint64_t received = 0;
    const std::string target = expand_target(source.file_path, source, encode_path(entry.path));
    const Response response = send_request(
        connect, widen(target), resume,
        [&stream, &staging, &received, resume](DWORD status) {
            const bool append = status == 206 && resume > 0;
            stream.open(staging, append ? (std::ios::binary | std::ios::app) : (std::ios::binary | std::ios::trunc));
            if (!stream)
            {
                return false;
            }
            received = append ? resume : 0;
            return true;
        },
        [&stream, &received](const char *data, DWORD size) {
            stream.write(data, static_cast<std::streamsize>(size));
            if (!stream)
            {
                return false;
            }
            received += size;
            return true;
        });
    stream.close();
    written = received > resume ? received - resume : 0;
    if (!response.transferred)
    {
        error = std::format("{}: {}", entry.path, response.error);
        return false;
    }
    if (entry.size != 0 && received != entry.size)
    {
        std::filesystem::remove(staging, code);
        code.clear();
        error = std::format("{}: size {} expected {}", entry.path, received, entry.size);
        return false;
    }
    std::filesystem::remove(destination, code);
    code.clear();
    std::filesystem::rename(staging, destination, code);
    if (code)
    {
        error = std::format("{}: {}", entry.path, code.message());
        return false;
    }
    return true;
}

#else

std::string quote_shell(std::string_view value)
{
    std::string quoted = "'";
    for (const char character : value)
    {
        if (character == '\'')
        {
            quoted += "'\\''";
            continue;
        }
        quoted.push_back(character);
    }
    quoted.push_back('\'');
    return quoted;
}

bool run_curl(const std::string &command)
{
    return std::system(command.c_str()) == 0;
}

std::string curl_header(const std::filesystem::path &dump, std::string_view name)
{
    const std::string body = read_all(dump);
    for (std::size_t start = 0; start < body.size();)
    {
        const auto end = body.find('\n', start);
        std::string_view line(body);
        line = line.substr(start, end == std::string::npos ? body.size() - start : end - start);
        start = end == std::string::npos ? body.size() : end + 1;
        const auto separator = line.find(':');
        if (separator == std::string_view::npos || separator != name.size())
        {
            continue;
        }
        bool matched = true;
        for (std::size_t index = 0; index < name.size() && matched; ++index)
        {
            matched = std::tolower(static_cast<unsigned char>(line[index])) ==
                      std::tolower(static_cast<unsigned char>(name[index]));
        }
        if (!matched)
        {
            continue;
        }
        std::string_view value = line.substr(separator + 1);
        while (!value.empty() && (value.front() == ' ' || value.front() == '\t'))
        {
            value.remove_prefix(1);
        }
        while (!value.empty() && (value.back() == '\r' || value.back() == ' '))
        {
            value.remove_suffix(1);
        }
        return std::string(value);
    }
    return {};
}

std::vector<AssetEntry> load_remote_tree(const AssetSource &source, const std::filesystem::path &scratch,
                                         std::string &error)
{
    std::vector<AssetEntry> entries;
    std::error_code code;
    std::filesystem::create_directories(scratch, code);
    code.clear();
    const std::filesystem::path body_file = scratch / "index.json";
    const std::filesystem::path head_file = scratch / "index.head";
    std::string target = expand_target(source.index_path, source, {});
    while (!target.empty())
    {
        const std::string url = std::format("https://{}{}", source.host, target);
        const std::string command =
            std::format("curl -sfL --retry 3 --connect-timeout 15 -D {} -o {} {}", quote_shell(head_file.string()),
                        quote_shell(body_file.string()), quote_shell(url));
        if (!run_curl(command))
        {
            error = std::format("asset index: curl failed for {}", target);
            return {};
        }
        parse_tree_page(read_all(body_file), entries);
        target = next_page_target(curl_header(head_file, "link"));
    }
    std::filesystem::remove(body_file, code);
    code.clear();
    std::filesystem::remove(head_file, code);
    return entries;
}

bool download_entry(const AssetSource &source, const AssetEntry &entry, const std::filesystem::path &destination,
                    std::uint64_t &written, std::string &error)
{
    std::error_code code;
    std::filesystem::create_directories(destination.parent_path(), code);
    code.clear();
    std::filesystem::path staging = destination;
    staging += ".part";
    const std::uintmax_t partial = std::filesystem::file_size(staging, code);
    const bool resume = !code && (entry.size == 0 || static_cast<std::uint64_t>(partial) < entry.size);
    const std::uint64_t carried = resume ? static_cast<std::uint64_t>(partial) : 0;
    code.clear();
    if (!resume)
    {
        std::filesystem::remove(staging, code);
        code.clear();
    }
    const std::string url =
        std::format("https://{}{}", source.host, expand_target(source.file_path, source, encode_path(entry.path)));
    std::string command = "curl -sfL --retry 3 --connect-timeout 15";
    if (resume)
    {
        command += " -C -";
    }
    command += " -o " + quote_shell(staging.string()) + ' ' + quote_shell(url);
    if (!run_curl(command))
    {
        const std::uintmax_t progressed = std::filesystem::file_size(staging, code);
        written = !code && static_cast<std::uint64_t>(progressed) > carried
                      ? static_cast<std::uint64_t>(progressed) - carried
                      : 0;
        error = std::format("{}: curl failed", entry.path);
        return false;
    }
    const std::uintmax_t received = std::filesystem::file_size(staging, code);
    if (code)
    {
        error = std::format("{}: {}", entry.path, code.message());
        return false;
    }
    written = static_cast<std::uint64_t>(received) > carried ? static_cast<std::uint64_t>(received) - carried : 0;
    if (entry.size != 0 && static_cast<std::uint64_t>(received) != entry.size)
    {
        std::filesystem::remove(staging, code);
        code.clear();
        error = std::format("{}: size {} expected {}", entry.path, received, entry.size);
        return false;
    }
    std::filesystem::remove(destination, code);
    code.clear();
    std::filesystem::rename(staging, destination, code);
    if (code)
    {
        error = std::format("{}: {}", entry.path, code.message());
        return false;
    }
    return true;
}

#endif

} // namespace

AssetSource read_asset_source(const std::filesystem::path &root)
{
    const std::filesystem::path encoded = root / std::filesystem::path(asset_source_encoded_name);
    const std::filesystem::path plain = root / std::filesystem::path(asset_source_name);
    const std::string body =
        std::filesystem::is_regular_file(encoded) ? decode_source_file(encoded) : decode_source_file(plain);
    AssetSource source{source_value(body, "host"),  source_value(body, "repo"), source_value(body, "branch"),
                       source_value(body, "index"), source_value(body, "file"), source_value(body, "prefix")};
    if (source.branch.empty())
    {
        source.branch = "main";
    }
    return source;
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
    std::ofstream stream(root / std::filesystem::path(asset_manifest_name), std::ios::trunc);
    if (!stream)
    {
        return;
    }
    stream << manifest_repo_key << " = " << source.repo << '\n'
           << manifest_voice_key << " = " << app::voice_code(voice) << '\n'
           << manifest_files_key << " = " << measure.files << '\n'
           << manifest_bytes_key << " = " << measure.bytes << '\n';
}

AssetPlan plan_assets(const std::filesystem::path &root, const AssetSource &source, app::VoiceLanguage voice)
{
    AssetPlan plan{{}, 0, 0, 0, {}};
    std::vector<AssetEntry> remote;
#if defined(_WIN32)
    const InternetHandle session = open_session();
    if (!session)
    {
        plan.error = describe_error("open session");
        return plan;
    }
    const InternetHandle connect = open_connection(session.get(), source.host);
    if (!connect)
    {
        plan.error = describe_error("connect");
        return plan;
    }
    remote = load_remote_tree(connect.get(), source, plan.error);
#else
    remote = load_remote_tree(source, root / std::filesystem::path(asset_scratch_name), plan.error);
#endif
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
#if defined(_WIN32)
    const InternetHandle session = open_session();
    if (!session)
    {
        outcome.error = describe_error("open session");
        outcome.failed = plan.pending.size();
        return outcome;
    }
#endif
    std::atomic<std::size_t> cursor{0};
    std::mutex guard;
    AssetProgress progress{0, plan.pending.size(), 0, plan.pending_bytes, {}};
    const std::size_t worker_count = std::min(download_worker_limit, plan.pending.size());
    std::vector<std::thread> workers;
    workers.reserve(worker_count);
    for (std::size_t worker = 0; worker < worker_count; ++worker)
    {
        workers.emplace_back([&]() {
#if defined(_WIN32)
            const InternetHandle connect = open_connection(session.get(), source.host);
            if (!connect)
            {
                const std::scoped_lock lock(guard);
                if (outcome.error.empty())
                {
                    outcome.error = describe_error("connect");
                }
                return;
            }
#endif
            for (;;)
            {
                const std::size_t index = cursor.fetch_add(1);
                if (index >= plan.pending.size())
                {
                    return;
                }
                const AssetEntry &entry = plan.pending[index];
                std::uint64_t written = 0;
                std::uint64_t total_written = 0;
                std::string error;
                bool downloaded = false;
                for (int attempt = 0; attempt < download_attempt_limit && !downloaded; ++attempt)
                {
                    written = 0;
                    error.clear();
#if defined(_WIN32)
                    downloaded = download_entry(connect.get(), source, entry,
                                                root / std::filesystem::path(entry.path), written, error);
#else
                    downloaded = download_entry(source, entry, root / std::filesystem::path(entry.path), written,
                                                error);
#endif
                    total_written += written;
                }
                written = total_written;
                const std::scoped_lock lock(guard);
                if (downloaded)
                {
                    ++outcome.downloaded;
                    outcome.bytes += written;
                }
                else
                {
                    ++outcome.failed;
                    if (outcome.error.empty())
                    {
                        outcome.error = error;
                    }
                }
                ++progress.completed;
                progress.bytes += written;
                progress.current = entry.path;
                if (report)
                {
                    report(progress);
                }
            }
        });
    }
    for (std::thread &worker : workers)
    {
        worker.join();
    }
    return outcome;
}

} // namespace evai::server::api
