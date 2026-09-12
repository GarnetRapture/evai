#include "eversoul/inference/generation_session.h"

#include <algorithm>
#include <charconv>
#include <span>
#include <utility>

#include "eversoul/inference/attention_mask.h"

namespace eversoul::inference {
namespace {

constexpr std::string_view kPrefillSignaturePrefix = "prefill";
constexpr std::string_view kDecodeSignatureName = "decode";

std::optional<std::int32_t> prefillSizeFromKey(std::string_view signature) {
    if (!signature.starts_with(kPrefillSignaturePrefix)) {
        return std::nullopt;
    }
    const std::size_t underscore = signature.rfind('_');
    if (underscore == std::string_view::npos || underscore + 1 >= signature.size()) {
        return std::nullopt;
    }
    const std::string_view digits = signature.substr(underscore + 1);
    std::int32_t size = 0;
    const auto result = std::from_chars(digits.data(), digits.data() + digits.size(), size);
    if (result.ec != std::errc() || result.ptr != digits.data() + digits.size() || size <= 0) {
        return std::nullopt;
    }
    return size;
}

std::vector<tokenizer::TokenId> startTokenIds(const litertlm::LlmMetadata& metadata) {
    if (!metadata.startToken.has_value()) {
        return {};
    }
    if (std::holds_alternative<litertlm::TokenIdSequence>(metadata.startToken->value)) {
        const litertlm::TokenIdSequence& ids = std::get<litertlm::TokenIdSequence>(metadata.startToken->value);
        return std::vector<tokenizer::TokenId>(ids.begin(), ids.end());
    }
    return {};
}

}

GenerationSession::GenerationSession(
    CompiledGraph& graph,
    const tokenizer::Tokenizer& tokenizer,
    const litertlm::LlmMetadata& metadata,
    GenerationLimits limits)
    : graph_(graph), tokenizer_(tokenizer), metadata_(metadata), limits_(limits) {
    for (const std::string& signature : graph_.signatureKeys()) {
        if (signature == kDecodeSignatureName) {
            decodeSignature_ = signature;
        }
        else if (auto size = prefillSizeFromKey(signature); size) {
            prefillSignatures_.emplace_back(*size, signature);
        }
    }
    std::ranges::sort(prefillSignatures_, [](const auto& left, const auto& right) {
        return left.first > right.first;
    });
}

core::Result<std::vector<tokenizer::TokenId>> GenerationSession::buildPromptTokens(const ChatPrompt& prompt) const {
    ChatPrompt budgeted = prompt;
    const std::int32_t promptBudget = std::max(1, limits_.maxContextTokens - limits_.maxOutputTokens);
    for (;;) {
        const std::string rendered = renderChatPrompt(metadata_, budgeted);
        auto encoded = tokenizer_.encode(rendered);
        if (!encoded) {
            return std::unexpected(encoded.error());
        }
        std::vector<tokenizer::TokenId> tokens = startTokenIds(metadata_);
        tokens.insert(tokens.end(), encoded->begin(), encoded->end());
        if (tokens.empty()) {
            return core::fail(core::FailureCode::NativeRuntime, "empty_prompt_tokens");
        }
        if (static_cast<std::int32_t>(tokens.size()) <= promptBudget) {
            return tokens;
        }
        if (budgeted.history.empty()) {
            return core::fail(core::FailureCode::NativeRuntime, "system_and_user_prompt_exceed_context_window");
        }
        budgeted.history.erase(budgeted.history.begin());
    }
}

core::Result<std::string> GenerationSession::selectPrefillSignature(std::int32_t tokenCount) const {
    for (const auto& [size, signature] : prefillSignatures_) {
        if (size <= tokenCount) {
            return signature;
        }
    }
    if (!prefillSignatures_.empty()) {
        return prefillSignatures_.back().second;
    }
    return core::fail(core::FailureCode::NativeRuntime, "no_prefill_signature");
}

core::Result<void> GenerationSession::feedStep(std::string_view signature, std::span<const tokenizer::TokenId> tokens, std::int32_t startPosition) {
    auto io = graph_.signatureIo(signature);
    if (!io) {
        return std::unexpected(io.error());
    }
    const auto queryLength = static_cast<std::int32_t>(tokens.size());
    std::vector<std::int32_t> positions(tokens.size());
    for (std::int32_t index = 0; index < queryLength; ++index) {
        positions[static_cast<std::size_t>(index)] = startPosition + index;
    }
    if (auto written = graph_.writeInputInt32(signature, io->inputTokens, tokens); !written) {
        return std::unexpected(written.error());
    }
    if (auto written = graph_.writeInputInt32(signature, io->inputPositions, positions); !written) {
        return std::unexpected(written.error());
    }
    if (!io->inputMask.empty()) {
        const AttentionMaskLayout layout{queryLength, limits_.maxContextTokens};
        AttentionMaskBuilder builder(limits_.slidingWindow);
        auto maskType = graph_.inputType(signature, io->inputMask);
        if (!maskType) {
            return std::unexpected(maskType.error());
        }
        if (*maskType == TensorElementType::Bool) {
            const std::vector<std::uint8_t> mask = builder.buildBoolMask(startPosition, layout);
            if (auto written = graph_.writeInputBool(signature, io->inputMask, mask); !written) {
                return std::unexpected(written.error());
            }
        }
        else {
            const std::vector<float> mask = builder.buildFloatMask(startPosition, layout);
            if (auto written = graph_.writeInputFloat(signature, io->inputMask, mask); !written) {
                return std::unexpected(written.error());
            }
        }
        if (!io->inputLocalMask.empty()) {
            const std::vector<float> mask = builder.buildFloatMask(startPosition, layout);
            if (auto written = graph_.writeInputFloat(signature, io->inputLocalMask, mask); !written) {
                return std::unexpected(written.error());
            }
        }
    }
    return graph_.run(signature);
}

core::Result<std::vector<float>> GenerationSession::prefill(std::span<const tokenizer::TokenId> tokens, std::string_view prefillSignature) {
    auto io = graph_.signatureIo(prefillSignature);
    if (!io) {
        return std::unexpected(io.error());
    }
    auto chunkShape = graph_.inputShape(prefillSignature, io->inputPositions);
    if (!chunkShape) {
        return std::unexpected(chunkShape.error());
    }
    std::int32_t chunkSize = static_cast<std::int32_t>(chunkShape->elementCount());
    if (chunkSize <= 0) {
        chunkSize = static_cast<std::int32_t>(tokens.size());
    }
    std::int32_t position = 0;
    const auto total = static_cast<std::int32_t>(tokens.size());
    std::vector<float> lastLogits;
    while (position < total) {
        const std::int32_t take = std::min(chunkSize, total - position);
        std::vector<tokenizer::TokenId> chunk(tokens.begin() + position, tokens.begin() + position + take);
        chunk.resize(static_cast<std::size_t>(chunkSize), 0);
        if (auto fed = feedStep(prefillSignature, chunk, position); !fed) {
            return std::unexpected(fed.error());
        }
        position += take;
    }
    auto logits = graph_.readOutputFloat(prefillSignature, io->outputLogits);
    if (!logits) {
        return std::unexpected(logits.error());
    }
    auto vocab = graph_.vocabSize(prefillSignature);
    if (!vocab) {
        return std::unexpected(vocab.error());
    }
    const std::size_t lastOffset = static_cast<std::size_t>(std::max(0, std::min(chunkSize, total) - 1)) * static_cast<std::size_t>(*vocab);
    if (lastOffset + static_cast<std::size_t>(*vocab) > logits->size()) {
        lastLogits.assign(logits->end() - *vocab, logits->end());
    }
    else {
        lastLogits.assign(logits->begin() + static_cast<std::ptrdiff_t>(lastOffset), logits->begin() + static_cast<std::ptrdiff_t>(lastOffset) + *vocab);
    }
    return lastLogits;
}

core::Result<GenerationOutcome> GenerationSession::generate(
    const ChatPrompt& prompt,
    const ChunkCallback& onChunk,
    const std::atomic<bool>& cancelled) {
    if (decodeSignature_.empty()) {
        return core::fail(core::FailureCode::NativeRuntime, "no_decode_signature");
    }
    auto decodeIo = graph_.signatureIo(decodeSignature_);
    if (!decodeIo) {
        return std::unexpected(decodeIo.error());
    }
    auto promptTokens = buildPromptTokens(prompt);
    if (!promptTokens) {
        return std::unexpected(promptTokens.error());
    }
    auto prefillSignature = selectPrefillSignature(static_cast<std::int32_t>(promptTokens->size()));
    if (!prefillSignature) {
        return std::unexpected(prefillSignature.error());
    }
    auto logits = prefill(*promptTokens, *prefillSignature);
    if (!logits) {
        return std::unexpected(logits.error());
    }

    TokenSampler sampler(resolveSamplingSettings(metadata_));
    StopTokenDetector stopDetector(metadata_, tokenizer_);
    std::vector<tokenizer::TokenId> generated;
    std::string decodedText;
    std::size_t emittedLength = 0;
    std::int32_t position = static_cast<std::int32_t>(promptTokens->size());
    bool wasCancelled = false;

    for (std::int32_t step = 0; step < limits_.maxOutputTokens; ++step) {
        if (cancelled.load(std::memory_order_relaxed)) {
            wasCancelled = true;
            break;
        }
        auto sampled = sampler.sample(*logits, metadata_.suppressTokens);
        if (!sampled) {
            return std::unexpected(sampled.error());
        }
        const tokenizer::TokenId token = *sampled;
        const bool stop = stopDetector.observe(token);
        generated.push_back(token);

        auto decoded = tokenizer_.decode(generated, true);
        if (decoded && decoded->size() > emittedLength) {
            const std::string_view fresh = std::string_view(*decoded).substr(emittedLength);
            if (!stop) {
                onChunk(fresh);
            }
            decodedText = *decoded;
            emittedLength = decoded->size();
        }
        if (stop || position >= limits_.maxContextTokens - 1) {
            break;
        }
        const std::array<tokenizer::TokenId, 1> nextInput{token};
        if (auto fed = feedStep(decodeSignature_, nextInput, position); !fed) {
            return std::unexpected(fed.error());
        }
        ++position;
        auto stepLogits = graph_.readOutputFloat(decodeSignature_, decodeIo->outputLogits);
        if (!stepLogits) {
            return std::unexpected(stepLogits.error());
        }
        logits->assign(stepLogits->begin(), stepLogits->end());
    }

    auto finalText = tokenizer_.decode(generated, true);
    return GenerationOutcome{
        finalText ? *finalText : decodedText,
        wasCancelled,
        static_cast<std::int32_t>(promptTokens->size()),
        static_cast<std::int32_t>(generated.size()),
    };
}

}
