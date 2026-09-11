#pragma once

#include <span>
#include <string>
#include <string_view>
#include <vector>

#include "eversoul/core/failure.h"
#include "eversoul/unicode/code_point_category.h"

namespace eversoul::tokenizer {

enum class PreTokenizerPattern {
    Gpt2,
    Qwen,
};

[[nodiscard]] core::Result<PreTokenizerPattern> recognizePreTokenizerPattern(std::string_view regexPattern);

class PreTokenizer {
public:
    PreTokenizer(PreTokenizerPattern pattern, bool splitIndividualDigits, const unicode::CodePointClassifier& classifier) noexcept;

    [[nodiscard]] core::Result<std::vector<std::string>> split(std::string_view text) const;

private:
    [[nodiscard]] std::vector<std::string> splitPieceIntoDigits(std::span<const char32_t> piece) const;

    PreTokenizerPattern pattern_;
    bool splitIndividualDigits_;
    const unicode::CodePointClassifier& classifier_;
};

}
