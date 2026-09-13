#include "litert_lm_library.h"

#include <array>
#include <cstdint>
#include <fstream>
#include <string_view>
#include <system_error>
#include <utility>

#ifdef _WIN32
#include <windows.h>
#else
#include <dlfcn.h>
#endif

namespace eversoul::native {
namespace {

#ifdef _WIN32
constexpr std::string_view kLibraryFileName = "litert-lm.dll";
#elif defined(__APPLE__)
constexpr std::string_view kLibraryFileName = "liblitert-lm.dylib";
#else
constexpr std::string_view kLibraryFileName = "liblitert-lm.so";
#endif

std::string pathUtf8(const std::filesystem::path& path) {
    const std::u8string value = path.generic_u8string();
    return std::string(reinterpret_cast<const char*>(value.data()), value.size());
}

std::string architectureForMachine(std::uint16_t machine, bool portableExecutable) {
    if (portableExecutable) {
        switch (machine) {
            case 0x8664: return "x86_64";
            case 0xaa64: return "arm64";
            case 0x014c: return "x86";
            default: return "unknown";
        }
    }
    switch (machine) {
        case 0x003e: return "x86_64";
        case 0x00b7: return "arm64";
        case 0x0003: return "x86";
        default: return "unknown";
    }
}

std::string binaryArchitecture(const std::filesystem::path& path) {
    std::ifstream input(path, std::ios::binary);
    if (!input) return "unknown";
    std::array<unsigned char, 64> header{};
    input.read(reinterpret_cast<char*>(header.data()), static_cast<std::streamsize>(header.size()));
    if (input.gcount() < 20) return "unknown";
    if (input.gcount() == static_cast<std::streamsize>(header.size()) && header[0] == 'M' && header[1] == 'Z') {
        const std::uint32_t offset = static_cast<std::uint32_t>(header[0x3c])
            | (static_cast<std::uint32_t>(header[0x3d]) << 8U)
            | (static_cast<std::uint32_t>(header[0x3e]) << 16U)
            | (static_cast<std::uint32_t>(header[0x3f]) << 24U);
        input.clear();
        input.seekg(static_cast<std::streamoff>(offset));
        std::array<unsigned char, 6> signature{};
        input.read(reinterpret_cast<char*>(signature.data()), static_cast<std::streamsize>(signature.size()));
        if (input.gcount() == static_cast<std::streamsize>(signature.size()) && signature[0] == 'P' && signature[1] == 'E'
            && signature[2] == 0 && signature[3] == 0) {
            return architectureForMachine(static_cast<std::uint16_t>(signature[4] | (signature[5] << 8U)), true);
        }
        return "unknown";
    }
    if (header[0] == 0x7f && header[1] == 'E' && header[2] == 'L' && header[3] == 'F') {
        const bool littleEndian = header[5] == 1;
        const auto machine = littleEndian
            ? static_cast<std::uint16_t>(header[18] | (header[19] << 8U))
            : static_cast<std::uint16_t>((header[18] << 8U) | header[19]);
        return architectureForMachine(machine, false);
    }
    return "unknown";
}

std::vector<std::filesystem::path> libraryCandidates(
    const std::filesystem::path& configuredPath,
    const std::filesystem::path& executableDirectory) {
    std::vector<std::filesystem::path> candidates;
    if (!configuredPath.empty()) {
        std::error_code error;
        candidates.push_back(std::filesystem::is_directory(configuredPath, error)
            ? configuredPath / kLibraryFileName : configuredPath);
    }
    else if (!executableDirectory.empty()) candidates.push_back(executableDirectory / kLibraryFileName);
    return candidates;
}

void* openModule(const std::filesystem::path& path) {
#ifdef _WIN32
    return static_cast<void*>(LoadLibraryExW(
        path.c_str(), nullptr, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS));
#else
    return dlopen(path.c_str(), RTLD_NOW | RTLD_LOCAL);
#endif
}

void closeModule(void* module) noexcept {
    if (module == nullptr) return;
#ifdef _WIN32
    FreeLibrary(static_cast<HMODULE>(module));
#else
    dlclose(module);
#endif
}

void* findSymbol(void* module, const char* name) {
#ifdef _WIN32
    return reinterpret_cast<void*>(GetProcAddress(static_cast<HMODULE>(module), name));
#else
    return dlsym(module, name);
#endif
}

template <typename Function>
bool bindSymbol(void* module, Function& target, const char* name) {
    target = reinterpret_cast<Function>(findSymbol(module, name));
    return target != nullptr;
}

const char* bindApi(void* module, LiteRtLmApi& api) {
#define EVERSOUL_BIND_LITERT_LM(member, symbol) if (!bindSymbol(module, api.member, #symbol)) return #symbol
    EVERSOUL_BIND_LITERT_LM(lastErrorMessage, litert_lm_get_last_error_message);
    EVERSOUL_BIND_LITERT_LM(setMinLogLevel, litert_lm_set_min_log_level);
    EVERSOUL_BIND_LITERT_LM(engineSettingsCreate, litert_lm_engine_settings_create);
    EVERSOUL_BIND_LITERT_LM(engineSettingsDelete, litert_lm_engine_settings_delete);
    EVERSOUL_BIND_LITERT_LM(engineSettingsSetMaxNumTokens, litert_lm_engine_settings_set_max_num_tokens);
    EVERSOUL_BIND_LITERT_LM(engineSettingsSetCacheDir, litert_lm_engine_settings_set_cache_dir);
    EVERSOUL_BIND_LITERT_LM(engineSettingsEnableBenchmark, litert_lm_engine_settings_enable_benchmark);
    EVERSOUL_BIND_LITERT_LM(engineCreate, litert_lm_engine_create);
    EVERSOUL_BIND_LITERT_LM(engineDelete, litert_lm_engine_delete);
    EVERSOUL_BIND_LITERT_LM(engineTokenize, litert_lm_engine_tokenize);
    EVERSOUL_BIND_LITERT_LM(tokenizeResultGetNumTokens, litert_lm_tokenize_result_get_num_tokens);
    EVERSOUL_BIND_LITERT_LM(tokenizeResultDelete, litert_lm_tokenize_result_delete);
    EVERSOUL_BIND_LITERT_LM(samplerParamsCreate, litert_lm_sampler_params_create);
    EVERSOUL_BIND_LITERT_LM(samplerParamsDelete, litert_lm_sampler_params_delete);
    EVERSOUL_BIND_LITERT_LM(samplerParamsSetTopK, litert_lm_sampler_params_set_top_k);
    EVERSOUL_BIND_LITERT_LM(samplerParamsSetTopP, litert_lm_sampler_params_set_top_p);
    EVERSOUL_BIND_LITERT_LM(samplerParamsSetTemperature, litert_lm_sampler_params_set_temperature);
    EVERSOUL_BIND_LITERT_LM(samplerParamsSetSeed, litert_lm_sampler_params_set_seed);
    EVERSOUL_BIND_LITERT_LM(sessionConfigCreate, litert_lm_session_config_create);
    EVERSOUL_BIND_LITERT_LM(sessionConfigDelete, litert_lm_session_config_delete);
    EVERSOUL_BIND_LITERT_LM(sessionConfigSetMaxOutputTokens, litert_lm_session_config_set_max_output_tokens);
    EVERSOUL_BIND_LITERT_LM(sessionConfigSetSamplerParams, litert_lm_session_config_set_sampler_params);
    EVERSOUL_BIND_LITERT_LM(conversationConfigCreate, litert_lm_conversation_config_create);
    EVERSOUL_BIND_LITERT_LM(conversationConfigDelete, litert_lm_conversation_config_delete);
    EVERSOUL_BIND_LITERT_LM(conversationConfigSetSessionConfig, litert_lm_conversation_config_set_session_config);
    EVERSOUL_BIND_LITERT_LM(conversationConfigSetSystemMessage, litert_lm_conversation_config_set_system_message);
    EVERSOUL_BIND_LITERT_LM(conversationConfigSetMessages, litert_lm_conversation_config_set_messages);
    EVERSOUL_BIND_LITERT_LM(conversationConfigSetConstraintProvider, litert_lm_conversation_config_set_constraint_provider);
    EVERSOUL_BIND_LITERT_LM(optionalArgsCreate, litert_lm_conversation_optional_args_create);
    EVERSOUL_BIND_LITERT_LM(optionalArgsDelete, litert_lm_conversation_optional_args_delete);
    EVERSOUL_BIND_LITERT_LM(optionalArgsSetMaxOutputTokens, litert_lm_conversation_optional_args_set_max_output_tokens);
    EVERSOUL_BIND_LITERT_LM(optionalArgsSetConstraint, litert_lm_conversation_optional_args_set_constraint);
    EVERSOUL_BIND_LITERT_LM(conversationCreate, litert_lm_conversation_create);
    EVERSOUL_BIND_LITERT_LM(conversationDelete, litert_lm_conversation_delete);
    EVERSOUL_BIND_LITERT_LM(conversationSendMessageStream, litert_lm_conversation_send_message_stream);
    EVERSOUL_BIND_LITERT_LM(conversationCancelProcess, litert_lm_conversation_cancel_process);
    EVERSOUL_BIND_LITERT_LM(conversationGetTokenCount, litert_lm_conversation_get_token_count);
    EVERSOUL_BIND_LITERT_LM(conversationGetBenchmarkInfo, litert_lm_conversation_get_benchmark_info);
    EVERSOUL_BIND_LITERT_LM(benchmarkInfoDelete, litert_lm_benchmark_info_delete);
    EVERSOUL_BIND_LITERT_LM(benchmarkPrefillTurns, litert_lm_benchmark_info_get_num_prefill_turns);
    EVERSOUL_BIND_LITERT_LM(benchmarkDecodeTurns, litert_lm_benchmark_info_get_num_decode_turns);
    EVERSOUL_BIND_LITERT_LM(benchmarkPrefillTokens, litert_lm_benchmark_info_get_prefill_token_count_at);
    EVERSOUL_BIND_LITERT_LM(benchmarkDecodeTokens, litert_lm_benchmark_info_get_decode_token_count_at);
    EVERSOUL_BIND_LITERT_LM(streamChunkGetText, litert_lm_stream_chunk_get_text);
    EVERSOUL_BIND_LITERT_LM(streamChunkIsFinal, litert_lm_stream_chunk_is_final);
    EVERSOUL_BIND_LITERT_LM(streamChunkGetError, litert_lm_stream_chunk_get_error);
#undef EVERSOUL_BIND_LITERT_LM
    return nullptr;
}

}

std::string nativeArchitecture() {
#if defined(_M_ARM64) || defined(__aarch64__)
    return "arm64";
#elif defined(_M_X64) || defined(__x86_64__)
    return "x86_64";
#elif defined(_M_IX86) || defined(__i386__)
    return "x86";
#else
    return "unknown";
#endif
}

LiteRtLmLibraryResolution resolveLiteRtLmLibrary(
    const std::filesystem::path& configuredPath,
    const std::filesystem::path& executableDirectory) {
    std::string lastError = "litert_lm_runtime_not_found";
    for (const std::filesystem::path& candidate : libraryCandidates(configuredPath, executableDirectory)) {
        std::error_code error;
        if (!std::filesystem::is_regular_file(candidate, error)) {
            lastError = "litert_lm_runtime_not_found:" + pathUtf8(candidate);
            continue;
        }
        const std::string architecture = binaryArchitecture(candidate);
        if (architecture != nativeArchitecture()) {
            lastError = "litert_lm_runtime_architecture_mismatch:" + architecture + ':' + nativeArchitecture();
            continue;
        }
        return LiteRtLmLibraryResolution{std::filesystem::absolute(candidate, error), {}};
    }
    return LiteRtLmLibraryResolution{{}, std::move(lastError)};
}

std::unique_ptr<LiteRtLmLibrary> LiteRtLmLibrary::open(
    const std::filesystem::path& configuredPath,
    const std::filesystem::path& executableDirectory,
    std::string& error) {
    LiteRtLmLibraryResolution resolution = resolveLiteRtLmLibrary(configuredPath, executableDirectory);
    if (resolution.path.empty()) {
        error = std::move(resolution.error);
        return nullptr;
    }
    auto library = std::unique_ptr<LiteRtLmLibrary>(new LiteRtLmLibrary(nullptr, {}, std::move(resolution.path)));
#ifdef _WIN32
    if (!SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_DEFAULT_DIRS)) {
        error = "litert_lm_dll_search_configuration_failed:" + std::to_string(GetLastError());
        return nullptr;
    }
    library->searchDirectory_ = AddDllDirectory(library->path_.parent_path().c_str());
    if (library->searchDirectory_ == nullptr) {
        error = "litert_lm_dll_directory_failed:" + std::to_string(GetLastError());
        return nullptr;
    }
#endif
    library->module_ = openModule(library->path_);
    if (library->module_ == nullptr) {
        error = "litert_lm_runtime_load_failed:" + pathUtf8(library->path_);
#ifdef _WIN32
        error += ":win32=" + std::to_string(GetLastError());
#else
        if (const char* detail = dlerror(); detail != nullptr) error += ':' + std::string(detail);
#endif
        return nullptr;
    }
    if (const char* missing = bindApi(library->module_, library->api_); missing != nullptr) {
        error = "litert_lm_runtime_incompatible:" + std::string(missing);
        return nullptr;
    }
    error.clear();
    return library;
}

LiteRtLmLibrary::LiteRtLmLibrary(void* module, LiteRtLmApi api, std::filesystem::path path, void* searchDirectory) noexcept
    : module_(module), searchDirectory_(searchDirectory), api_(api), path_(std::move(path)) {}

LiteRtLmLibrary::~LiteRtLmLibrary() {
    closeModule(module_);
#ifdef _WIN32
    if (searchDirectory_ != nullptr) RemoveDllDirectory(searchDirectory_);
#endif
}

}
