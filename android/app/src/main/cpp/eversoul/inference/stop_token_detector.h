#pragma once

#include <cstdint>
#include <deque>
#include <vector>

#include "eversoul/litertlm/llm_metadata.h"
#include "eversoul/tokenizer/tokenizer.h"

namespace eversoul::inference {

class StopTokenDetector {
public:
    StopTokenDetector(const litertlm::LlmMetadata& metadata, const tokenizer::Tokenizer& tokenizer);

    [[nodiscard]] bool observe(tokenizer::TokenId token);
    void reset() noexcept;

    [[nodiscard]] std::size_t longestStopLength() const noexcept { return longestStopLength_; }

private:
    std::vector<std::vector<tokenizer::TokenId>> stopSequences_;
    std::deque<tokenizer::TokenId> recent_;
    std::size_t longestStopLength_ = 0;
};

}
