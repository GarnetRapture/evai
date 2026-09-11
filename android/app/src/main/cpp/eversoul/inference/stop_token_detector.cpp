#include "eversoul/inference/stop_token_detector.h"

#include <algorithm>
#include <variant>

namespace eversoul::inference {
namespace {

std::vector<tokenizer::TokenId> resolveStopSequence(const litertlm::TokenUnion& token, const tokenizer::Tokenizer& tokenizer) {
    if (std::holds_alternative<litertlm::TokenIdSequence>(token.value)) {
        const litertlm::TokenIdSequence& ids = std::get<litertlm::TokenIdSequence>(token.value);
        return std::vector<tokenizer::TokenId>(ids.begin(), ids.end());
    }
    const std::string& text = std::get<std::string>(token.value);
    if (auto id = tokenizer.tokenToId(text); id) {
        return {*id};
    }
    if (auto encoded = tokenizer.encode(text); encoded) {
        return *encoded;
    }
    return {};
}

}

StopTokenDetector::StopTokenDetector(const litertlm::LlmMetadata& metadata, const tokenizer::Tokenizer& tokenizer) {
    for (const litertlm::TokenUnion& stopToken : metadata.stopTokens) {
        std::vector<tokenizer::TokenId> sequence = resolveStopSequence(stopToken, tokenizer);
        if (!sequence.empty()) {
            longestStopLength_ = std::max(longestStopLength_, sequence.size());
            stopSequences_.push_back(std::move(sequence));
        }
    }
}

bool StopTokenDetector::observe(tokenizer::TokenId token) {
    recent_.push_back(token);
    if (longestStopLength_ > 0 && recent_.size() > longestStopLength_) {
        recent_.pop_front();
    }
    for (const std::vector<tokenizer::TokenId>& sequence : stopSequences_) {
        if (sequence.size() > recent_.size()) {
            continue;
        }
        const std::size_t offset = recent_.size() - sequence.size();
        if (std::equal(sequence.begin(), sequence.end(), recent_.begin() + static_cast<std::ptrdiff_t>(offset))) {
            return true;
        }
    }
    return false;
}

void StopTokenDetector::reset() noexcept {
    recent_.clear();
}

}
