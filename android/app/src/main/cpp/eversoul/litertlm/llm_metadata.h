#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <variant>
#include <vector>

#include "eversoul/core/failure.h"
#include "eversoul/format/byte_reader.h"

namespace eversoul::litertlm {

using TokenIdSequence = std::vector<std::int32_t>;

struct TokenUnion {
    std::variant<TokenIdSequence, std::string> value;
};

struct PromptAffixes {
    std::string prefix;
    std::string suffix;
};

struct PromptTemplates {
    std::optional<PromptAffixes> user;
    std::optional<PromptAffixes> model;
    std::optional<PromptAffixes> system;
};

enum class SamplerType : std::int32_t {
    Unspecified = 0,
    TopK = 1,
    TopP = 2,
    Greedy = 3,
};

struct SamplerParameters {
    SamplerType type = SamplerType::Unspecified;
    std::int32_t k = 0;
    float p = 0.0F;
    float temperature = 0.0F;
    std::optional<std::int32_t> seed;
};

enum class LlmModelFamily {
    Unspecified,
    Generic,
    Gemma3n,
    FunctionGemma,
    Gemma3,
    Qwen3,
    Qwen2p5,
    Gemma4,
    FastVlm,
    Lfm2,
    MiniCpm5,
};

struct GenericModelSettings {
    std::optional<std::string> modelRole;
    std::optional<bool> forceStringContent;
};

struct ResponseChannel {
    std::string name;
    std::string start;
    std::string end;
    std::optional<bool> reasoning;
};

struct LlmMetadata {
    std::optional<TokenUnion> startToken;
    std::vector<TokenUnion> stopTokens;
    std::optional<PromptTemplates> promptTemplates;
    std::optional<SamplerParameters> samplerParameters;
    std::int32_t maxNumTokens = 0;
    LlmModelFamily modelFamily = LlmModelFamily::Unspecified;
    std::optional<GenericModelSettings> genericModel;
    std::optional<std::string> jinjaPromptTemplate;
    std::vector<ResponseChannel> channels;
    TokenIdSequence suppressTokens;
    std::optional<std::int64_t> kvCacheInitValue;
    std::optional<bool> supportsThinking;
    std::optional<bool> supportsFunctionCalling;
    std::optional<TokenUnion> padToken;
    std::optional<std::string> minRuntimeVersion;
};

[[nodiscard]] core::Result<LlmMetadata> decodeLlmMetadata(format::ByteSpan message);

}
