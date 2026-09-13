#include "model_runtime.h"

#include <algorithm>
#include <atomic>
#include <cctype>
#include <cmath>
#include <condition_variable>
#include <deque>
#include <functional>
#include <mutex>
#include <stdexcept>
#include <string_view>
#include <thread>
#include <utility>
#include <vector>

#include <nlohmann/json.hpp>

#include "litert_lm_library.h"
#include "native_settings.h"

namespace eversoul::native {
namespace {

std::string pathUtf8(const std::filesystem::path& path) {
    const std::u8string value = path.generic_u8string();
    return std::string(reinterpret_cast<const char*>(value.data()), value.size());
}

std::filesystem::path pathFromUtf8(const std::string& value) {
    return std::filesystem::path(std::u8string(
        reinterpret_cast<const char8_t*>(value.data()),
        reinterpret_cast<const char8_t*>(value.data() + value.size())));
}

std::filesystem::path absoluteNormalized(const std::filesystem::path& path) {
    if (path.empty()) return {};
    std::error_code error;
    std::filesystem::path value = std::filesystem::absolute(path, error);
    if (error) value = path;
    const std::filesystem::path canonical = std::filesystem::weakly_canonical(value, error);
    return error ? value.lexically_normal() : canonical;
}

bool pathWithin(const std::filesystem::path& root, const std::filesystem::path& candidate) {
    const auto normalizedRoot = absoluteNormalized(root);
    const auto normalizedCandidate = absoluteNormalized(candidate);
    auto rootPart = normalizedRoot.begin();
    auto candidatePart = normalizedCandidate.begin();
    for (; rootPart != normalizedRoot.end(); ++rootPart, ++candidatePart) {
        if (candidatePart == normalizedCandidate.end() || *rootPart != *candidatePart) return false;
    }
    return true;
}

bool supportedModelExtension(const std::filesystem::path& path) {
    std::string extension = path.extension().string();
    std::ranges::transform(extension, extension.begin(), [](unsigned char character) {
        return static_cast<char>(std::tolower(character));
    });
    return extension == ".litertlm" || extension == ".task";
}

std::filesystem::path resolveModelFile(const ModelConfiguration& configuration) {
    if (configuration.modelPath.empty()) return {};
    const std::filesystem::path configured = absoluteNormalized(configuration.modelPath);
    std::error_code error;
    if (std::filesystem::is_regular_file(configured, error)) {
        if (!supportedModelExtension(configured)) throw std::runtime_error("unsupported_model_format_expected_litertlm_or_task");
        return configured;
    }
    if (!std::filesystem::is_directory(configured, error)) return {};
    if (!configuration.modelFile.empty()) {
        const std::filesystem::path relative = pathFromUtf8(configuration.modelFile);
        if (relative.is_absolute()) throw std::runtime_error("model_file_must_be_relative");
        const std::filesystem::path candidate = absoluteNormalized(configured / relative);
        if (!pathWithin(configured, candidate)) throw std::runtime_error("model_file_outside_configured_path");
        if (!supportedModelExtension(candidate)) throw std::runtime_error("unsupported_model_format_expected_litertlm_or_task");
        return std::filesystem::is_regular_file(candidate, error) ? candidate : std::filesystem::path{};
    }
    std::vector<std::filesystem::path> matches;
    for (std::filesystem::directory_iterator entry(configured, error), end; !error && entry != end; entry.increment(error)) {
        if (entry->is_regular_file(error) && !error && supportedModelExtension(entry->path())) matches.push_back(entry->path());
    }
    if (error) throw std::runtime_error("model_directory_read_failed");
    if (matches.size() > 1) throw std::runtime_error("model_file_ambiguous");
    return matches.empty() ? std::filesystem::path{} : absoluteNormalized(matches.front());
}

std::int32_t parsePositiveSetting(const NativeSettings& settings, std::string_view key, std::int32_t fallback) {
    const auto found = settings.find(key);
    if (found == settings.end()) return fallback;
    try {
        const int value = std::stoi(found->second);
        return value > 0 ? value : fallback;
    }
    catch (...) {
        return fallback;
    }
}

constexpr std::int32_t kMaximumOutputTokens = 8192;
constexpr std::size_t kMaximumOutputBytes = 96U * 1024U;
constexpr std::string_view kGpuBackend = "gpu";
constexpr std::string_view kCpuBackend = "cpu";

std::string dumpJson(const nlohmann::json& value) {
    return value.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace);
}

nlohmann::json textContent(const std::string& text) {
    return nlohmann::json::array({nlohmann::json{{"type", "text"}, {"text", text}}});
}

nlohmann::json chatMessageJson(const NativeChatMessage& message) {
    return nlohmann::json{{"role", message.role}, {"content", textContent(message.content)}};
}

std::string streamedText(std::string_view chunkJson) {
    const nlohmann::json message = nlohmann::json::parse(chunkJson, nullptr, false);
    if (message.is_discarded() || !message.is_object()) throw std::runtime_error("invalid_litert_stream_json");
    const auto content = message.find("content");
    if (content == message.end()) return {};
    if (content->is_string()) return content->get<std::string>();
    if (!content->is_array()) return {};
    std::string text;
    for (const nlohmann::json& item : *content) {
        if (!item.is_object()) continue;
        const auto type = item.find("type");
        const auto value = item.find("text");
        if (type != item.end() && type->is_string() && type->get<std::string>() == "text"
            && value != item.end() && value->is_string()) {
            text += value->get<std::string>();
        }
    }
    return text;
}

struct LiteRtLmEngineDeleter {
    decltype(LiteRtLmApi::engineDelete) destroy = nullptr;
    void operator()(LiteRtLmEngine* engine) const noexcept {
        if (engine != nullptr) destroy(engine);
    }
};

using LiteRtLmEngineHandle = std::unique_ptr<LiteRtLmEngine, LiteRtLmEngineDeleter>;

struct LiteRtLmStream {
    const LiteRtLmApi* api = nullptr;
    std::function<void(std::string_view)> append;
    std::mutex mutex;
    std::condition_variable condition;
    bool finished = false;
    bool callbackFailed = false;
    std::string error;
};

void receiveStreamChunk(void* data, const LiteRtLmStreamChunk* chunk) noexcept {
    auto* stream = static_cast<LiteRtLmStream*>(data);
    // No C++ exception may cross the C callback ABI. Even on a bad chunk we
    // keep the callback context alive until the upstream final notification.
    try {
        if (const char* error = stream->api->streamChunkGetError(chunk); error != nullptr) {
            std::scoped_lock lock(stream->mutex);
            stream->error = error;
        }
        if (const char* text = stream->api->streamChunkGetText(chunk); text != nullptr) {
            const std::string fresh = streamedText(text);
            if (!fresh.empty()) stream->append(fresh);
        }
    }
    catch (...) {
        std::scoped_lock lock(stream->mutex);
        // Allocating an error string in a noexcept callback could itself fail.
        stream->callbackFailed = true;
    }
    if (stream->api->streamChunkIsFinal(chunk)) {
        std::scoped_lock lock(stream->mutex);
        stream->finished = true;
        stream->condition.notify_all();
    }
}

LiteRtLmEngineHandle createEngine(
    const LiteRtLmApi& api,
    const std::string& modelPath,
    std::string_view backend,
    std::int32_t contextWindow,
    const std::string& cacheDirectory) {
    const std::string backendName(backend);
    std::unique_ptr<LiteRtLmEngineSettings, decltype(api.engineSettingsDelete)> settings(
        api.engineSettingsCreate(modelPath.c_str(), backendName.c_str(), nullptr, nullptr), api.engineSettingsDelete);
    if (!settings) return LiteRtLmEngineHandle(nullptr, LiteRtLmEngineDeleter{api.engineDelete});
    api.engineSettingsSetMaxNumTokens(settings.get(), contextWindow);
    api.engineSettingsSetCacheDir(settings.get(), cacheDirectory.c_str());
    api.engineSettingsEnableBenchmark(settings.get());
    return LiteRtLmEngineHandle(api.engineCreate(settings.get()), LiteRtLmEngineDeleter{api.engineDelete});
}

std::string apiFailure(const LiteRtLmApi& api, std::string message) {
    if (const char* detail = api.lastErrorMessage(); detail != nullptr && *detail != '\0') message += ':' + std::string(detail);
    return message;
}

}

class NativeModelRuntime::Impl {
public:
    Impl(std::filesystem::path executablePath, std::filesystem::path settingsPath)
        : executablePath_(absoluteNormalized(executablePath)), settingsPath_(absoluteNormalized(settingsPath)) {
        const NativeSettings settings = readNativeSettings(settingsPath_);
        if (const auto value = settings.find("model_path"); value != settings.end()) configuration_.modelPath = pathFromUtf8(value->second);
        if (const auto value = settings.find("model_file"); value != settings.end()) configuration_.modelFile = value->second;
        if (const auto value = settings.find("litert_runtime_path"); value != settings.end()) configuration_.runtimePath = pathFromUtf8(value->second);
        if (const auto value = settings.find("inference_backend"); value != settings.end()) configuration_.backend = value->second;
        configuration_.contextWindow = parsePositiveSetting(settings, "inference_context_window", 4096);
        try { validateConfiguration(configuration_); }
        catch (const std::exception& error) { lastError_ = error.what(); }
    }

    ~Impl() {
        unload();
    }

    void configure(ModelConfiguration configuration, bool persist) {
        validateConfiguration(configuration);
        configuration.modelPath = absoluteNormalized(configuration.modelPath);
        if (!configuration.runtimePath.empty()) configuration.runtimePath = absoluteNormalized(configuration.runtimePath);
        // Write first: a failed INI replacement must leave the active model and
        // in-memory configuration untouched.
        if (persist) {
            updateNativeSettings(settingsPath_, {
                {"model_path", pathUtf8(configuration.modelPath)},
                {"model_file", configuration.modelFile},
                {"litert_runtime_path", pathUtf8(configuration.runtimePath)},
                {"inference_backend", configuration.backend},
                {"inference_context_window", std::to_string(configuration.contextWindow)},
            });
        }
        unload();
        {
            std::scoped_lock lock(mutex_);
            if (configuration.runtimePath != configuration_.runtimePath) library_.reset();
            configuration_ = std::move(configuration);
            generation_ = {};
            lastError_.clear();
        }
    }

    void load() {
        joinFinishedWorker();
        ModelConfiguration configurationSnapshot;
        {
            std::scoped_lock lock(mutex_);
            if (engine_) return;
            configurationSnapshot = configuration_;
        }
        validateConfiguration(configurationSnapshot);
        const std::filesystem::path modelFile = resolveModelFile(configurationSnapshot);
        if (modelFile.empty()) {
            setError("configured_model_not_found");
            throw std::runtime_error("configured_model_not_found");
        }
        const LiteRtLmLibrary* library = openLibrary(configurationSnapshot.runtimePath);
        const std::filesystem::path cacheDirectory = settingsPath_.parent_path() / "litert-cache";
        std::error_code directoryError;
        std::filesystem::create_directories(cacheDirectory, directoryError);
        if (directoryError) {
            setError("litert_cache_directory_failed");
            throw std::runtime_error("litert_cache_directory_failed");
        }
        const LiteRtLmApi& api = library->api();
        api.setMinLogLevel(kLiteRtLmLogSeverityError);
        std::vector<std::string_view> backends;
        if (configurationSnapshot.backend == kGpuBackend) backends.push_back(kGpuBackend);
        backends.push_back(kCpuBackend);
        LiteRtLmEngineHandle engine(nullptr, LiteRtLmEngineDeleter{api.engineDelete});
        std::string_view activeBackend;
        for (std::string_view backend : backends) {
            engine = createEngine(api, pathUtf8(modelFile), backend, configurationSnapshot.contextWindow, pathUtf8(cacheDirectory));
            if (engine) {
                activeBackend = backend;
                break;
            }
        }
        if (!engine) {
            const std::string error = apiFailure(api, "litert_lm_engine_create_failed:" + pathUtf8(modelFile));
            setError(error);
            throw std::runtime_error(error);
        }
        {
            std::scoped_lock lock(mutex_);
            engine_ = std::move(engine);
            activeBackend_ = std::string(activeBackend);
            resolvedModelPath_ = modelFile;
            lastError_.clear();
        }
    }

    void unload() {
        requestCancellation();
        if (worker_.joinable()) worker_.join();
        std::scoped_lock lock(mutex_);
        engine_.reset();
        activeBackend_.clear();
        resolvedModelPath_.clear();
        if (generation_.state == "running" || generation_.state == "queued") generation_.state = "cancelled";
        condition_.notify_all();
    }

    void startGeneration(std::string requestId, NativeGenerationRequest request) {
        if (requestId.empty() || requestId.size() > 256) throw std::runtime_error("invalid_request_id");
        if (request.messages.empty() || request.messages.back().role != "user" || request.messages.back().content.empty()) {
            throw std::runtime_error("invalid_generation_messages");
        }
        if (request.maxOutputTokens <= 0 || request.maxOutputTokens > kMaximumOutputTokens) {
            throw std::runtime_error("invalid_max_output_tokens");
        }
        validateSampling(request.sampling);
        for (const auto& message : request.messages) {
            if ((message.role != "user" && message.role != "assistant") || message.content.find('\0') != message.content.npos) throw std::runtime_error("invalid_generation_messages");
        }
        if (request.systemPrompt.find('\0') != request.systemPrompt.npos) throw std::runtime_error("invalid_system_prompt");
        if (!request.responseSchema.empty()) {
            const auto schema = nlohmann::json::parse(request.responseSchema, nullptr, false);
            if (!schema.is_object() && !schema.is_boolean()) throw std::runtime_error("invalid_response_schema");
        }
        load();
        joinFinishedWorker();
        {
            std::scoped_lock lock(mutex_);
            if (generation_.state == "running" || generation_.state == "queued") throw std::runtime_error("generation_already_running");
            if (std::ranges::any_of(completed_, [&](const auto& previous) { return previous.requestId == requestId; })) throw std::runtime_error("duplicate_generation_request_id");
            if (request.maxOutputTokens >= configuration_.contextWindow) throw std::runtime_error("output_tokens_exceed_context_window");
            generation_ = GenerationStatus{std::move(requestId), "queued", {}, 0, 0, {}};
            cancelRequested_.store(false, std::memory_order_relaxed);
        }
        try {
            worker_ = std::jthread([this, request = std::move(request)] {
                try { runGeneration(request); }
                catch (const std::exception& error) { finishGeneration("failed", error.what(), 0, 0); }
                catch (...) { finishGeneration("failed", "litert_lm_generation_exception", 0, 0); }
            });
        }
        catch (...) {
            finishGeneration("failed", "generation_worker_start_failed", 0, 0);
            throw;
        }
    }

    GenerationStatus waitForGeneration(const std::string& requestId) {
        std::unique_lock lock(mutex_);
        validateRequestId(requestId);
        condition_.wait(lock, [this, &requestId] {
            return generation_.requestId != requestId || (generation_.state != "queued" && generation_.state != "running");
        });
        return findGeneration(requestId);
    }

    void cancelGeneration(const std::string& requestId) {
        {
            std::scoped_lock lock(mutex_);
            validateRequestId(requestId);
            if (generation_.requestId != requestId) return;
            if (generation_.state != "running" && generation_.state != "queued") return;
        }
        requestCancellation();
    }

    ModelRuntimeStatus status() const {
        std::scoped_lock lock(mutex_);
        std::filesystem::path resolved;
        std::string resolutionError;
        try {
            resolved = resolveModelFile(configuration_);
        }
        catch (const std::exception& error) {
            resolutionError = error.what();
        }
        const auto runtimeResolution = library_
            ? LiteRtLmLibraryResolution{library_->path(), {}}
            : resolveLiteRtLmLibrary(configuration_.runtimePath, executablePath_.parent_path());
        const std::string error = !resolutionError.empty() ? resolutionError
            : !lastError_.empty() ? lastError_ : runtimeResolution.error;
        return ModelRuntimeStatus{
            !configuration_.modelPath.empty(),
            !resolved.empty(),
            engine_ != nullptr,
            configuration_.modelPath,
            engine_ ? resolvedModelPath_ : resolved,
            runtimeResolution.path,
            configuration_.backend,
            activeBackend_,
            nativeArchitecture(),
            configuration_.contextWindow,
            error,
        };
    }

    GenerationStatus generationStatus(const std::string& requestId) const {
        std::scoped_lock lock(mutex_);
        return requestId.empty() ? generation_ : findGeneration(requestId);
    }

    ModelConfiguration configuration() const {
        std::scoped_lock lock(mutex_);
        return configuration_;
    }

private:
    static void validateConfiguration(const ModelConfiguration& configuration) {
        if (configuration.backend != kGpuBackend && configuration.backend != kCpuBackend) {
            throw std::runtime_error("unsupported_inference_backend");
        }
        if (configuration.contextWindow < 256 || configuration.contextWindow > 131072) {
            throw std::runtime_error("invalid_context_window");
        }
        if (!configuration.modelFile.empty() && pathFromUtf8(configuration.modelFile).is_absolute()) {
            throw std::runtime_error("model_file_must_be_relative");
        }
    }

    static void validateSampling(const NativeSamplingParameters& sampling) {
        if (sampling.topK <= 0) throw std::runtime_error("invalid_sampling_top_k");
        if (!(sampling.topP >= 0.0F && sampling.topP <= 1.0F)) throw std::runtime_error("invalid_sampling_top_p");
        if (!std::isfinite(sampling.temperature) || sampling.temperature < 0.0F) throw std::runtime_error("invalid_sampling_temperature");
    }

    const LiteRtLmLibrary* openLibrary(const std::filesystem::path& runtimePath) {
        std::scoped_lock lock(mutex_);
        if (library_) return library_.get();
        std::string error;
        library_ = LiteRtLmLibrary::open(runtimePath, executablePath_.parent_path(), error);
        if (!library_) {
            lastError_ = error;
            throw std::runtime_error(error);
        }
        return library_.get();
    }

    void validateRequestId(const std::string& requestId) const {
        (void)findGeneration(requestId);
    }

    const GenerationStatus& findGeneration(const std::string& requestId) const {
        for (const auto& previous : completed_) if (previous.requestId == requestId) return previous;
        if (generation_.requestId.empty()) throw std::runtime_error("generation_not_found");
        if (!requestId.empty() && generation_.requestId != requestId) throw std::runtime_error("generation_request_mismatch");
        return generation_;
    }

    void setError(std::string error) {
        std::scoped_lock lock(mutex_);
        lastError_ = std::move(error);
    }

    void joinFinishedWorker() {
        bool join = false;
        {
            std::scoped_lock lock(mutex_);
            join = worker_.joinable() && generation_.state != "running" && generation_.state != "queued";
        }
        if (join) worker_.join();
    }

    void requestCancellation() {
        cancelRequested_.store(true, std::memory_order_relaxed);
        std::scoped_lock conversationLock(conversationMutex_);
        if (activeConversation_ != nullptr) activeApi_->conversationCancelProcess(activeConversation_);
    }

    void finishGeneration(std::string state, std::string error, std::int32_t promptTokens, std::int32_t generatedTokens) {
        std::scoped_lock lock(mutex_);
        generation_.state = std::move(state);
        generation_.error = std::move(error);
        generation_.promptTokens = promptTokens;
        generation_.generatedTokens = generatedTokens;
        completed_.push_back(generation_);
        if (completed_.size() > 8) completed_.pop_front();
        if (generation_.state == "failed") lastError_ = generation_.error;
        else lastError_.clear();
        condition_.notify_all();
    }

    void runGeneration(const NativeGenerationRequest& request) {
        LiteRtLmEngine* engine = nullptr;
        const LiteRtLmApi* api = nullptr;
        {
            std::scoped_lock lock(mutex_);
            generation_.state = "running";
            engine = engine_.get();
            api = library_ ? &library_->api() : nullptr;
            condition_.notify_all();
        }
        if (engine == nullptr || api == nullptr) {
            finishGeneration("failed", "model_not_ready", 0, 0);
            return;
        }

        std::unique_ptr<LiteRtLmSamplerParams, decltype(api->samplerParamsDelete)> sampler(
            api->samplerParamsCreate(request.sampling.temperature == 0.0F ? kLiteRtLmSamplerTypeGreedy : kLiteRtLmSamplerTypeTopP), api->samplerParamsDelete);
        std::unique_ptr<LiteRtLmSessionConfig, decltype(api->sessionConfigDelete)> sessionConfig(
            api->sessionConfigCreate(), api->sessionConfigDelete);
        std::unique_ptr<LiteRtLmConversationConfig, decltype(api->conversationConfigDelete)> conversationConfig(
            api->conversationConfigCreate(), api->conversationConfigDelete);
        std::unique_ptr<LiteRtLmConversationOptionalArgs, decltype(api->optionalArgsDelete)> optionalArgs(
            api->optionalArgsCreate(), api->optionalArgsDelete);
        if (!sampler || !sessionConfig || !conversationConfig || !optionalArgs) {
            finishGeneration("failed", "litert_lm_config_create_failed", 0, 0);
            return;
        }
        api->samplerParamsSetTopK(sampler.get(), request.sampling.topK);
        api->samplerParamsSetTopP(sampler.get(), request.sampling.topP);
        api->samplerParamsSetTemperature(sampler.get(), request.sampling.temperature);
        api->samplerParamsSetSeed(sampler.get(), request.sampling.seed);
        api->sessionConfigSetSamplerParams(sessionConfig.get(), sampler.get());
        api->sessionConfigSetMaxOutputTokens(sessionConfig.get(), request.maxOutputTokens);
        api->conversationConfigSetSessionConfig(conversationConfig.get(), sessionConfig.get());

        const std::string systemMessage = request.systemPrompt.empty() ? std::string{} : dumpJson(textContent(request.systemPrompt));
        if (!systemMessage.empty()) api->conversationConfigSetSystemMessage(conversationConfig.get(), systemMessage.c_str());
        nlohmann::json initialMessages = nlohmann::json::array();
        for (std::size_t index = 0; index + 1 < request.messages.size(); ++index) {
            initialMessages.push_back(chatMessageJson(request.messages[index]));
        }
        const std::string initialMessagesJson = dumpJson(initialMessages);
        if (!initialMessages.empty()) api->conversationConfigSetMessages(conversationConfig.get(), initialMessagesJson.c_str());
        if (!request.responseSchema.empty()) {
            const LiteRtLmConstraintProviderType provider = kLiteRtLmConstraintProviderTypeLlGuidance;
            api->conversationConfigSetConstraintProvider(conversationConfig.get(), &provider);
            api->optionalArgsSetConstraint(optionalArgs.get(), kLiteRtLmConstraintTypeJsonSchema, request.responseSchema.c_str());
        }
        api->optionalArgsSetMaxOutputTokens(optionalArgs.get(), request.maxOutputTokens);

        LiteRtLmStream stream;
        stream.api = api;
        // Destroy the conversation before its callback context and always clear
        // the cancellation pointer, including exception exits.
        const auto deleteConversation = [this, api](LiteRtLmConversation* value) noexcept {
            {
                std::scoped_lock conversationLock(conversationMutex_);
                if (activeConversation_ == value) {
                    api->conversationCancelProcess(value);
                    activeConversation_ = nullptr;
                    activeApi_ = nullptr;
                }
            }
            api->conversationDelete(value);
        };
        std::unique_ptr<LiteRtLmConversation, decltype(deleteConversation)> conversation(
            api->conversationCreate(engine, conversationConfig.get()), deleteConversation);
        if (!conversation) {
            finishGeneration("failed", apiFailure(*api, "litert_lm_conversation_create_failed"), 0, 0);
            return;
        }

        stream.append = [this](std::string_view chunk) {
            std::scoped_lock lock(mutex_);
            if (generation_.text.size() + chunk.size() > kMaximumOutputBytes) throw std::runtime_error("generation_output_too_large");
            generation_.text.append(chunk);
        };
        const std::string userMessage = dumpJson(chatMessageJson(request.messages.back()));
        int started = 0;
        {
            std::scoped_lock conversationLock(conversationMutex_);
            if (!cancelRequested_.load(std::memory_order_relaxed)) {
                started = api->conversationSendMessageStream(
                    conversation.get(), userMessage.c_str(), nullptr, optionalArgs.get(), &receiveStreamChunk, &stream);
                if (started == 0) {
                    activeApi_ = api;
                    activeConversation_ = conversation.get();
                }
            }
            else {
                started = -1;
            }
        }
        if (started != 0) {
            if (cancelRequested_.load(std::memory_order_relaxed)) finishGeneration("cancelled", {}, 0, 0);
            else finishGeneration("failed", apiFailure(*api, "litert_lm_stream_start_failed:" + std::to_string(started)), 0, 0);
            return;
        }
        std::string streamError;
        {
            std::unique_lock lock(stream.mutex);
            stream.condition.wait(lock, [&stream] { return stream.finished; });
            streamError = stream.callbackFailed ? "invalid_or_oversized_stream_output" : stream.error;
        }
        {
            std::scoped_lock conversationLock(conversationMutex_);
            activeConversation_ = nullptr;
            activeApi_ = nullptr;
        }

        std::string text;
        {
            std::scoped_lock lock(mutex_);
            text = generation_.text;
        }
        const bool cancelled = cancelRequested_.load(std::memory_order_relaxed);
        // Runtime token counters include the actual template and decode tokens;
        // re-tokenizing rendered text would omit special/thinking tokens.
        std::int32_t promptTokens = 0;
        std::int32_t generatedTokens = 0;
        std::unique_ptr<LiteRtLmBenchmarkInfo, decltype(api->benchmarkInfoDelete)> counters(
            api->conversationGetBenchmarkInfo(conversation.get()), api->benchmarkInfoDelete);
        if (counters) {
            for (int index = 0; index < api->benchmarkPrefillTurns(counters.get()); ++index) promptTokens += api->benchmarkPrefillTokens(counters.get(), index);
            for (int index = 0; index < api->benchmarkDecodeTurns(counters.get()); ++index) generatedTokens += api->benchmarkDecodeTokens(counters.get(), index);
        }
        if (cancelled) {
            finishGeneration("cancelled", {}, promptTokens, generatedTokens);
        }
        else if (!streamError.empty()) {
            finishGeneration("failed", "litert_lm_generation_failed:" + streamError, promptTokens, generatedTokens);
        }
        else if (!request.responseSchema.empty() && nlohmann::json::parse(text, nullptr, false).is_discarded()) {
            finishGeneration("failed", "litert_lm_incomplete_structured_response", promptTokens, generatedTokens);
        }
        else if (text.empty()) {
            finishGeneration("failed", "litert_lm_empty_response", promptTokens, generatedTokens);
        }
        else {
            finishGeneration("completed", {}, promptTokens, generatedTokens);
        }
    }

    std::filesystem::path executablePath_;
    std::filesystem::path settingsPath_;
    mutable std::mutex mutex_;
    std::condition_variable condition_;
    ModelConfiguration configuration_;
    std::filesystem::path resolvedModelPath_;
    std::unique_ptr<LiteRtLmLibrary> library_;
    LiteRtLmEngineHandle engine_{nullptr, LiteRtLmEngineDeleter{}};
    std::string activeBackend_;
    std::mutex conversationMutex_;
    const LiteRtLmApi* activeApi_ = nullptr;
    LiteRtLmConversation* activeConversation_ = nullptr;
    std::jthread worker_;
    std::atomic<bool> cancelRequested_{false};
    GenerationStatus generation_;
    std::deque<GenerationStatus> completed_;
    std::string lastError_;
};

NativeModelRuntime::NativeModelRuntime(std::filesystem::path executablePath, std::filesystem::path settingsPath)
    : impl_(std::make_unique<Impl>(std::move(executablePath), std::move(settingsPath))) {}

NativeModelRuntime::~NativeModelRuntime() = default;
void NativeModelRuntime::configure(ModelConfiguration configuration, bool persist) { impl_->configure(std::move(configuration), persist); }
void NativeModelRuntime::load() { impl_->load(); }
void NativeModelRuntime::unload() { impl_->unload(); }
void NativeModelRuntime::startGeneration(std::string requestId, NativeGenerationRequest request) { impl_->startGeneration(std::move(requestId), std::move(request)); }
GenerationStatus NativeModelRuntime::waitForGeneration(const std::string& requestId) { return impl_->waitForGeneration(requestId); }
void NativeModelRuntime::cancelGeneration(const std::string& requestId) { impl_->cancelGeneration(requestId); }
ModelRuntimeStatus NativeModelRuntime::status() const { return impl_->status(); }
GenerationStatus NativeModelRuntime::generationStatus(const std::string& requestId) const { return impl_->generationStatus(requestId); }
ModelConfiguration NativeModelRuntime::configuration() const { return impl_->configuration(); }

}
