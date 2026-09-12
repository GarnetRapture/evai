#include "model_runtime.h"

#include <algorithm>
#include <atomic>
#include <condition_variable>
#include <cctype>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <utility>
#include <vector>

#include "eversoul/core/failure.h"
#include "eversoul/inference/compiled_graph_factory.h"
#include "eversoul/inference/engine.h"
#include "litert_runtime_loader.h"
#include "native_code_point_classifier.h"
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
    if (std::filesystem::is_regular_file(configured, error)) return configured;
    if (!std::filesystem::is_directory(configured, error)) return {};
    if (!configuration.modelFile.empty()) {
        const std::filesystem::path relative = pathFromUtf8(configuration.modelFile);
        if (relative.is_absolute()) throw std::runtime_error("model_file_must_be_relative");
        const std::filesystem::path candidate = absoluteNormalized(configured / relative);
        if (!pathWithin(configured, candidate)) throw std::runtime_error("model_file_outside_configured_path");
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

}

class NativeModelRuntime::Impl {
public:
    Impl(std::filesystem::path executablePath, std::filesystem::path settingsPath)
        : executablePath_(absoluteNormalized(executablePath)), settingsPath_(absoluteNormalized(settingsPath)),
          classifier_(std::make_shared<NativeCodePointClassifier>()) {
        const NativeSettings settings = readNativeSettings(settingsPath_);
        if (const auto value = settings.find("model_path"); value != settings.end()) configuration_.modelPath = pathFromUtf8(value->second);
        if (const auto value = settings.find("model_file"); value != settings.end()) configuration_.modelFile = value->second;
        if (const auto value = settings.find("litert_runtime_path"); value != settings.end()) configuration_.runtimePath = pathFromUtf8(value->second);
        if (const auto value = settings.find("inference_backend"); value != settings.end()) configuration_.backend = value->second;
        configuration_.contextWindow = parsePositiveSetting(settings, "inference_context_window", 4096);
        validateConfiguration(configuration_);
    }

    ~Impl() {
        unload();
    }

    void configure(ModelConfiguration configuration, bool persist) {
        validateConfiguration(configuration);
        configuration.modelPath = absoluteNormalized(configuration.modelPath);
        if (!configuration.runtimePath.empty()) configuration.runtimePath = absoluteNormalized(configuration.runtimePath);
        unload();
        {
            std::scoped_lock lock(mutex_);
            configuration_ = std::move(configuration);
            lastError_.clear();
        }
        if (persist) {
            const ModelConfiguration snapshot = this->configuration();
            updateNativeSettings(settingsPath_, {
                {"model_path", pathUtf8(snapshot.modelPath)},
                {"model_file", snapshot.modelFile},
                {"litert_runtime_path", pathUtf8(snapshot.runtimePath)},
                {"inference_backend", snapshot.backend},
                {"inference_context_window", std::to_string(snapshot.contextWindow)},
            });
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
        const std::filesystem::path modelFile = resolveModelFile(configurationSnapshot);
        if (modelFile.empty()) {
            setError("configured_model_not_found");
            throw std::runtime_error("configured_model_not_found");
        }
        const LiteRtRuntimeStatus runtime = loadLiteRtRuntime(
            configurationSnapshot.runtimePath, executablePath_.parent_path(), modelFile.parent_path());
        if (!runtime.loaded) {
            setError(runtime.error);
            throw std::runtime_error(runtime.error);
        }
        const std::filesystem::path cacheDirectory = executablePath_.parent_path() / "litert-cache";
        std::error_code directoryError;
        std::filesystem::create_directories(cacheDirectory, directoryError);
        if (directoryError) {
            setError("litert_cache_directory_failed");
            throw std::runtime_error("litert_cache_directory_failed");
        }
        const inference::CompiledGraphOptions options{
            inference::ComputeBackend::Cpu,
            configurationSnapshot.contextWindow,
            pathUtf8(cacheDirectory),
        };
        auto loaded = inference::LiteRtLmEngine::load(pathUtf8(modelFile), options, classifier_);
        if (!loaded) {
            const std::string error = std::string(core::failureCodeName(loaded.error().code)) + ':' + loaded.error().detail;
            setError(error);
            throw std::runtime_error(error);
        }
        {
            std::scoped_lock lock(mutex_);
            engine_ = std::move(*loaded);
            resolvedModelPath_ = modelFile;
            lastError_.clear();
        }
    }

    void unload() {
        cancelled_.store(true, std::memory_order_relaxed);
        if (worker_.joinable()) worker_.join();
        {
            std::scoped_lock lock(mutex_);
            engine_.reset();
            resolvedModelPath_.clear();
            if (generation_.state == "running" || generation_.state == "queued") generation_.state = "cancelled";
            condition_.notify_all();
        }
        unloadLiteRtRuntime();
    }

    void startGeneration(std::string requestId, NativeGenerationPrompt prompt, std::int32_t maxOutputTokens) {
        if (requestId.empty()) throw std::runtime_error("missing_request_id");
        if (prompt.messages.empty() || prompt.messages.back().role != "user" || prompt.messages.back().content.empty()) {
            throw std::runtime_error("invalid_generation_messages");
        }
        if (maxOutputTokens <= 0 || maxOutputTokens > 8192) throw std::runtime_error("invalid_max_output_tokens");
        load();
        joinFinishedWorker();
        {
            std::scoped_lock lock(mutex_);
            if (generation_.state == "running" || generation_.state == "queued") throw std::runtime_error("generation_already_running");
            generation_ = GenerationStatus{std::move(requestId), "queued", {}, 0, 0, {}};
            cancelled_.store(false, std::memory_order_relaxed);
        }
        worker_ = std::thread([this, prompt = std::move(prompt), maxOutputTokens] {
            runGeneration(prompt, maxOutputTokens);
        });
    }

    GenerationStatus waitForGeneration(const std::string& requestId) {
        std::unique_lock lock(mutex_);
        validateRequestId(requestId);
        condition_.wait(lock, [this] { return generation_.state != "queued" && generation_.state != "running"; });
        return generation_;
    }

    void cancelGeneration(const std::string& requestId) {
        std::scoped_lock lock(mutex_);
        validateRequestId(requestId);
        if (generation_.state == "running" || generation_.state == "queued") cancelled_.store(true, std::memory_order_relaxed);
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
        const LiteRtRuntimeStatus runtime = liteRtRuntimeStatus();
        return ModelRuntimeStatus{
            !configuration_.modelPath.empty(),
            !resolved.empty(),
            engine_ != nullptr,
            configuration_.modelPath,
            engine_ ? resolvedModelPath_ : resolved,
            runtime.loaded ? runtime.path : configuration_.runtimePath,
            configuration_.backend,
            nativeArchitecture(),
            engine_ ? engine_->contextWindow() : configuration_.contextWindow,
            resolutionError.empty() ? lastError_ : resolutionError,
        };
    }

    GenerationStatus generationStatus(const std::string& requestId) const {
        std::scoped_lock lock(mutex_);
        if (!requestId.empty()) validateRequestId(requestId);
        return generation_;
    }

    ModelConfiguration configuration() const {
        std::scoped_lock lock(mutex_);
        return configuration_;
    }

private:
    static void validateConfiguration(const ModelConfiguration& configuration) {
        if (configuration.backend != "cpu") throw std::runtime_error("unsupported_inference_backend");
        if (configuration.contextWindow < 256 || configuration.contextWindow > 131072) {
            throw std::runtime_error("invalid_context_window");
        }
        if (!configuration.modelFile.empty() && pathFromUtf8(configuration.modelFile).is_absolute()) {
            throw std::runtime_error("model_file_must_be_relative");
        }
    }

    void validateRequestId(const std::string& requestId) const {
        if (generation_.requestId.empty()) throw std::runtime_error("generation_not_found");
        if (!requestId.empty() && generation_.requestId != requestId) throw std::runtime_error("generation_request_mismatch");
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

    void runGeneration(const NativeGenerationPrompt& request, std::int32_t maxOutputTokens) {
        inference::LiteRtLmEngine* engine = nullptr;
        {
            std::scoped_lock lock(mutex_);
            generation_.state = "running";
            engine = engine_.get();
            condition_.notify_all();
        }
        inference::ChatPrompt prompt;
        prompt.systemPrompt = request.systemPrompt;
        prompt.userMessage = request.messages.back().content;
        prompt.responsePrefix = request.responsePrefix;
        prompt.history.reserve(request.messages.size() - 1);
        for (std::size_t index = 0; index + 1 < request.messages.size(); ++index) {
            const NativeChatMessage& message = request.messages[index];
            const inference::ChatRole role = message.role == "assistant"
                ? inference::ChatRole::Model : inference::ChatRole::User;
            prompt.history.push_back(inference::ChatTurn{role, message.content});
        }
        const auto emit = [this](std::string_view chunk) {
            std::scoped_lock lock(mutex_);
            generation_.text.append(chunk);
        };
        auto outcome = engine->generate(prompt, maxOutputTokens, emit, cancelled_);
        std::scoped_lock lock(mutex_);
        if (!outcome) {
            generation_.state = cancelled_.load(std::memory_order_relaxed) ? "cancelled" : "failed";
            generation_.error = std::string(core::failureCodeName(outcome.error().code)) + ':' + outcome.error().detail;
            lastError_ = generation_.error;
        }
        else {
            generation_.promptTokens = outcome->promptTokens;
            generation_.generatedTokens = outcome->generatedTokens;
            generation_.state = outcome->cancelled ? "cancelled" : "completed";
            lastError_.clear();
        }
        condition_.notify_all();
    }

    std::filesystem::path executablePath_;
    std::filesystem::path settingsPath_;
    std::shared_ptr<NativeCodePointClassifier> classifier_;
    mutable std::mutex mutex_;
    std::condition_variable condition_;
    ModelConfiguration configuration_;
    std::filesystem::path resolvedModelPath_;
    std::unique_ptr<inference::LiteRtLmEngine> engine_;
    std::thread worker_;
    std::atomic<bool> cancelled_{false};
    GenerationStatus generation_;
    std::string lastError_;
};

NativeModelRuntime::NativeModelRuntime(std::filesystem::path executablePath, std::filesystem::path settingsPath)
    : impl_(std::make_unique<Impl>(std::move(executablePath), std::move(settingsPath))) {}

NativeModelRuntime::~NativeModelRuntime() = default;
void NativeModelRuntime::configure(ModelConfiguration configuration, bool persist) { impl_->configure(std::move(configuration), persist); }
void NativeModelRuntime::load() { impl_->load(); }
void NativeModelRuntime::unload() { impl_->unload(); }
void NativeModelRuntime::startGeneration(std::string requestId, NativeGenerationPrompt prompt, std::int32_t maxOutputTokens) { impl_->startGeneration(std::move(requestId), std::move(prompt), maxOutputTokens); }
GenerationStatus NativeModelRuntime::waitForGeneration(const std::string& requestId) { return impl_->waitForGeneration(requestId); }
void NativeModelRuntime::cancelGeneration(const std::string& requestId) { impl_->cancelGeneration(requestId); }
ModelRuntimeStatus NativeModelRuntime::status() const { return impl_->status(); }
GenerationStatus NativeModelRuntime::generationStatus(const std::string& requestId) const { return impl_->generationStatus(requestId); }
ModelConfiguration NativeModelRuntime::configuration() const { return impl_->configuration(); }

}
