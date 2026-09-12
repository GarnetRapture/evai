#pragma once

#include <filesystem>
#include <memory>
#include <string>
#include <vector>

#include "c/conversation.h"
#include "c/engine.h"

namespace eversoul::native {

struct LiteRtLmApi {
    decltype(&::litert_lm_set_min_log_level) setMinLogLevel = nullptr;
    decltype(&::litert_lm_engine_settings_create) engineSettingsCreate = nullptr;
    decltype(&::litert_lm_engine_settings_delete) engineSettingsDelete = nullptr;
    decltype(&::litert_lm_engine_settings_set_max_num_tokens) engineSettingsSetMaxNumTokens = nullptr;
    decltype(&::litert_lm_engine_settings_set_cache_dir) engineSettingsSetCacheDir = nullptr;
    decltype(&::litert_lm_engine_create) engineCreate = nullptr;
    decltype(&::litert_lm_engine_delete) engineDelete = nullptr;
    decltype(&::litert_lm_engine_tokenize) engineTokenize = nullptr;
    decltype(&::litert_lm_tokenize_result_get_num_tokens) tokenizeResultGetNumTokens = nullptr;
    decltype(&::litert_lm_tokenize_result_delete) tokenizeResultDelete = nullptr;
    decltype(&::litert_lm_sampler_params_create) samplerParamsCreate = nullptr;
    decltype(&::litert_lm_sampler_params_delete) samplerParamsDelete = nullptr;
    decltype(&::litert_lm_sampler_params_set_top_k) samplerParamsSetTopK = nullptr;
    decltype(&::litert_lm_sampler_params_set_top_p) samplerParamsSetTopP = nullptr;
    decltype(&::litert_lm_sampler_params_set_temperature) samplerParamsSetTemperature = nullptr;
    decltype(&::litert_lm_sampler_params_set_seed) samplerParamsSetSeed = nullptr;
    decltype(&::litert_lm_session_config_create) sessionConfigCreate = nullptr;
    decltype(&::litert_lm_session_config_delete) sessionConfigDelete = nullptr;
    decltype(&::litert_lm_session_config_set_max_output_tokens) sessionConfigSetMaxOutputTokens = nullptr;
    decltype(&::litert_lm_session_config_set_sampler_params) sessionConfigSetSamplerParams = nullptr;
    decltype(&::litert_lm_conversation_config_create) conversationConfigCreate = nullptr;
    decltype(&::litert_lm_conversation_config_delete) conversationConfigDelete = nullptr;
    decltype(&::litert_lm_conversation_config_set_session_config) conversationConfigSetSessionConfig = nullptr;
    decltype(&::litert_lm_conversation_config_set_system_message) conversationConfigSetSystemMessage = nullptr;
    decltype(&::litert_lm_conversation_config_set_messages) conversationConfigSetMessages = nullptr;
    decltype(&::litert_lm_conversation_config_set_constraint_provider) conversationConfigSetConstraintProvider = nullptr;
    decltype(&::litert_lm_conversation_optional_args_create) optionalArgsCreate = nullptr;
    decltype(&::litert_lm_conversation_optional_args_delete) optionalArgsDelete = nullptr;
    decltype(&::litert_lm_conversation_optional_args_set_max_output_tokens) optionalArgsSetMaxOutputTokens = nullptr;
    decltype(&::litert_lm_conversation_optional_args_set_constraint) optionalArgsSetConstraint = nullptr;
    decltype(&::litert_lm_conversation_create) conversationCreate = nullptr;
    decltype(&::litert_lm_conversation_delete) conversationDelete = nullptr;
    decltype(&::litert_lm_conversation_send_message_stream) conversationSendMessageStream = nullptr;
    decltype(&::litert_lm_conversation_cancel_process) conversationCancelProcess = nullptr;
    decltype(&::litert_lm_conversation_get_token_count) conversationGetTokenCount = nullptr;
    decltype(&::litert_lm_stream_chunk_get_text) streamChunkGetText = nullptr;
    decltype(&::litert_lm_stream_chunk_is_final) streamChunkIsFinal = nullptr;
    decltype(&::litert_lm_stream_chunk_get_error) streamChunkGetError = nullptr;
};

struct LiteRtLmLibraryResolution {
    std::filesystem::path path;
    std::string error;
};

class LiteRtLmLibrary {
public:
    [[nodiscard]] static std::unique_ptr<LiteRtLmLibrary> open(
        const std::filesystem::path& configuredPath,
        const std::filesystem::path& executableDirectory,
        std::string& error);

    ~LiteRtLmLibrary();

    LiteRtLmLibrary(const LiteRtLmLibrary&) = delete;
    LiteRtLmLibrary& operator=(const LiteRtLmLibrary&) = delete;

    [[nodiscard]] const LiteRtLmApi& api() const noexcept { return api_; }
    [[nodiscard]] const std::filesystem::path& path() const noexcept { return path_; }

private:
    LiteRtLmLibrary(void* module, LiteRtLmApi api, std::filesystem::path path) noexcept;

    void* module_ = nullptr;
    LiteRtLmApi api_;
    std::filesystem::path path_;
};

[[nodiscard]] LiteRtLmLibraryResolution resolveLiteRtLmLibrary(
    const std::filesystem::path& configuredPath,
    const std::filesystem::path& executableDirectory);
[[nodiscard]] std::string nativeArchitecture();

}
