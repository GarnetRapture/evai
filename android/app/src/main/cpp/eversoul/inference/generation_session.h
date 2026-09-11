#pragma once

#include <atomic>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <vector>

#include "eversoul/core/failure.h"
#include "eversoul/inference/chat_prompt.h"
#include "eversoul/inference/stop_token_detector.h"
#include "eversoul/inference/tensor.h"
#include "eversoul/inference/token_sampler.h"
#include "eversoul/litertlm/llm_metadata.h"
#include "eversoul/tokenizer/tokenizer.h"

namespace eversoul::inference {

struct GenerationLimits {
    std::int32_t maxContextTokens;
    std::int32_t maxOutputTokens;
    std::int32_t slidingWindow;
};

struct GenerationOutcome {
    std::string text;
    bool cancelled;
    std::int32_t promptTokens;
    std::int32_t generatedTokens;
};

using ChunkCallback = std::function<void(std::string_view)>;

class GenerationSession {
public:
    GenerationSession(
        CompiledGraph& graph,
        const tokenizer::Tokenizer& tokenizer,
        const litertlm::LlmMetadata& metadata,
        GenerationLimits limits);

    [[nodiscard]] core::Result<GenerationOutcome> generate(
        const ChatPrompt& prompt,
        const ChunkCallback& onChunk,
        const std::atomic<bool>& cancelled);

private:
    [[nodiscard]] core::Result<std::vector<tokenizer::TokenId>> buildPromptTokens(const ChatPrompt& prompt) const;
    [[nodiscard]] core::Result<std::vector<float>> prefill(std::span<const tokenizer::TokenId> tokens, std::string_view prefillSignature);
    [[nodiscard]] core::Result<std::string> selectPrefillSignature(std::int32_t tokenCount) const;
    [[nodiscard]] core::Result<void> feedStep(std::string_view signature, std::span<const tokenizer::TokenId> tokens, std::int32_t startPosition);

    CompiledGraph& graph_;
    const tokenizer::Tokenizer& tokenizer_;
    const litertlm::LlmMetadata& metadata_;
    GenerationLimits limits_;
    ModelSignatureNames decodeIo_;
    std::string decodeSignature_;
    std::vector<std::pair<std::int32_t, std::string>> prefillSignatures_;
};

}
