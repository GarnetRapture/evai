#include "eversoul/inference/token_sampler.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <numeric>
#include <string>

namespace eversoul::inference {
namespace {

constexpr std::int32_t kGreedyTopK = 1;
constexpr float kDefaultTopP = 0.95F;
constexpr float kDefaultTemperature = 1.0F;
constexpr std::uint32_t kDefaultSeed = 0;

bool isSuppressed(std::int32_t token, std::span<const std::int32_t> suppressedTokens) noexcept {
    return std::ranges::find(suppressedTokens, token) != suppressedTokens.end();
}

}

SamplingSettings resolveSamplingSettings(const litertlm::LlmMetadata& metadata) noexcept {
    SamplingSettings settings{kGreedyTopK, kDefaultTopP, kDefaultTemperature, kDefaultSeed};
    if (!metadata.samplerParameters.has_value()) {
        return settings;
    }
    const litertlm::SamplerParameters& parameters = *metadata.samplerParameters;
    if (parameters.seed.has_value()) {
        settings.seed = static_cast<std::uint32_t>(*parameters.seed);
    }
    switch (parameters.type) {
        case litertlm::SamplerType::Greedy:
        case litertlm::SamplerType::Unspecified:
            return settings;
        case litertlm::SamplerType::TopK:
            settings.topK = std::max(parameters.k, kGreedyTopK);
            settings.topP = 1.0F;
            settings.temperature = parameters.temperature;
            return settings;
        case litertlm::SamplerType::TopP:
            settings.topK = std::max(parameters.k, kGreedyTopK);
            settings.topP = parameters.p;
            settings.temperature = parameters.temperature;
            return settings;
    }
    return settings;
}

TokenSampler::TokenSampler(SamplingSettings settings) : settings_(settings), generator_(settings.seed) {}

std::int32_t TokenSampler::argmax(std::span<const float> logits, std::span<const std::int32_t> suppressedTokens) const {
    std::int32_t best = -1;
    float bestLogit = -std::numeric_limits<float>::infinity();
    for (std::size_t index = 0; index < logits.size(); ++index) {
        const auto token = static_cast<std::int32_t>(index);
        if (logits[index] > bestLogit && !isSuppressed(token, suppressedTokens)) {
            bestLogit = logits[index];
            best = token;
        }
    }
    return best;
}

core::Result<std::int32_t> TokenSampler::sample(std::span<const float> logits, std::span<const std::int32_t> suppressedTokens) {
    if (logits.empty()) {
        return core::fail(core::FailureCode::NativeRuntime, "empty_logits");
    }
    if (settings_.topP < 0.0F || settings_.topP > 1.0F || settings_.temperature < 0.0F) {
        return core::fail(core::FailureCode::NativeRuntime, "invalid_sampler_settings");
    }
    if (settings_.topK <= kGreedyTopK) {
        const std::int32_t token = argmax(logits, suppressedTokens);
        if (token < 0) {
            return core::fail(core::FailureCode::NativeRuntime, "no_sampleable_token");
        }
        return token;
    }
    candidates_.resize(logits.size());
    std::iota(candidates_.begin(), candidates_.end(), 0);
    const auto removed = std::ranges::remove_if(candidates_, [&](std::int32_t token) {
        return isSuppressed(token, suppressedTokens) || !std::isfinite(logits[static_cast<std::size_t>(token)]);
    });
    candidates_.erase(removed.begin(), removed.end());
    if (candidates_.empty()) {
        return core::fail(core::FailureCode::NativeRuntime, "no_sampleable_token");
    }
    const std::size_t candidateCount = std::min(candidates_.size(), static_cast<std::size_t>(settings_.topK));
    const auto byLogitDescending = [&](std::int32_t left, std::int32_t right) {
        const float leftLogit = logits[static_cast<std::size_t>(left)];
        const float rightLogit = logits[static_cast<std::size_t>(right)];
        return leftLogit != rightLogit ? leftLogit > rightLogit : left < right;
    };
    std::partial_sort(candidates_.begin(), candidates_.begin() + static_cast<std::ptrdiff_t>(candidateCount), candidates_.end(), byLogitDescending);
    candidates_.resize(candidateCount);

    const float temperature = std::max(settings_.temperature, std::numeric_limits<float>::epsilon());
    const float maxLogit = logits[static_cast<std::size_t>(candidates_.front())];
    probabilities_.resize(candidateCount);
    double sum = 0.0;
    for (std::size_t index = 0; index < candidateCount; ++index) {
        const double weight = std::exp(static_cast<double>(logits[static_cast<std::size_t>(candidates_[index])] - maxLogit) / temperature);
        probabilities_[index] = weight;
        sum += weight;
    }
    if (!(sum > std::numeric_limits<double>::epsilon()) || !std::isfinite(sum)) {
        return candidates_.front();
    }
    std::size_t cutoff = 0;
    double cumulative = 0.0;
    for (std::size_t index = 0; index < candidateCount; ++index) {
        probabilities_[index] /= sum;
        cumulative += probabilities_[index];
        cutoff = index + 1;
        if (cumulative >= static_cast<double>(settings_.topP)) {
            break;
        }
    }
    std::uniform_real_distribution<double> distribution(0.0, cumulative);
    const double target = distribution(generator_);
    double running = 0.0;
    for (std::size_t index = 0; index < cutoff; ++index) {
        running += probabilities_[index];
        if (target <= running) {
            return candidates_[index];
        }
    }
    return candidates_[cutoff - 1];
}

}
