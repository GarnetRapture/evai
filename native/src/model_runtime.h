#pragma once

#include <cstdint>
#include <filesystem>
#include <memory>
#include <string>
#include <vector>

namespace eversoul::native {

struct ModelConfiguration {
    std::filesystem::path modelPath;
    std::string modelFile;
    std::filesystem::path runtimePath;
    std::string backend = "gpu";
    std::int32_t contextWindow = 4096;
};

struct ModelRuntimeStatus {
    bool configured = false;
    bool modelFound = false;
    bool loaded = false;
    std::filesystem::path configuredModelPath;
    std::filesystem::path resolvedModelPath;
    std::filesystem::path runtimePath;
    std::string backend;
    std::string activeBackend;
    std::string architecture;
    std::int32_t contextWindow = 0;
    std::string error;
};

struct GenerationStatus {
    std::string requestId;
    std::string state = "idle";
    std::string text;
    std::int32_t promptTokens = 0;
    std::int32_t generatedTokens = 0;
    std::string error;
};

struct NativeChatMessage {
    std::string role;
    std::string content;
};

struct NativeSamplingParameters {
    std::int32_t topK = 40;
    float topP = 0.95F;
    float temperature = 0.8F;
    std::int32_t seed = 0;
};

struct NativeGenerationRequest {
    std::string systemPrompt;
    std::vector<NativeChatMessage> messages;
    std::string responseSchema;
    std::int32_t maxOutputTokens = 512;
    NativeSamplingParameters sampling;
};

class NativeModelRuntime {
public:
    NativeModelRuntime(
        std::filesystem::path executablePath,
        std::filesystem::path settingsPath);
    ~NativeModelRuntime();

    NativeModelRuntime(const NativeModelRuntime&) = delete;
    NativeModelRuntime& operator=(const NativeModelRuntime&) = delete;

    void configure(ModelConfiguration configuration, bool persist);
    void load();
    void unload();
    void startGeneration(std::string requestId, NativeGenerationRequest request);
    [[nodiscard]] GenerationStatus waitForGeneration(const std::string& requestId);
    void cancelGeneration(const std::string& requestId);
    [[nodiscard]] ModelRuntimeStatus status() const;
    [[nodiscard]] GenerationStatus generationStatus(const std::string& requestId = {}) const;
    [[nodiscard]] ModelConfiguration configuration() const;

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

}
