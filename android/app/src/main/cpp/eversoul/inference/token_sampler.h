#pragma once

#include <cstdint>
#include <random>
#include <span>
#include <vector>

#include "eversoul/core/failure.h"
#include "eversoul/litertlm/llm_metadata.h"

namespace eversoul::inference {

struct SamplingSettings {
    std::int32_t topK;
    float topP;
    float temperature;
    std::uint32_t seed;
};

[[nodiscard]] SamplingSettings resolveSamplingSettings(const litertlm::LlmMetadata& metadata) noexcept;

class TokenSampler {
public:
    explicit TokenSampler(SamplingSettings settings);

    [[nodiscard]] core::Result<std::int32_t> sample(std::span<const float> logits, std::span<const std::int32_t> suppressedTokens);

private:
    [[nodiscard]] std::int32_t argmax(std::span<const float> logits, std::span<const std::int32_t> suppressedTokens) const;

    SamplingSettings settings_;
    std::mt19937 generator_;
    std::vector<std::int32_t> candidates_;
    std::vector<float> scaledLogits_;
    std::vector<double> probabilities_;
};

}
