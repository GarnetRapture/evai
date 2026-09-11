#pragma once

#include <cstdint>
#include <memory>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

#include "eversoul/core/failure.h"
#include "eversoul/tokenizer/byte_level.h"
#include "eversoul/tokenizer/pre_tokenizer.h"
#include "eversoul/tokenizer/tokenizer.h"
#include "eversoul/unicode/code_point_category.h"

namespace eversoul::tokenizer {

struct SpecialTokenEntry {
    std::string content;
    TokenId id;
};

class HuggingFaceTokenizer final : public Tokenizer {
public:
    [[nodiscard]] static core::Result<std::unique_ptr<HuggingFaceTokenizer>> create(
        std::string_view tokenizerJson, std::shared_ptr<const unicode::CodePointClassifier> classifier);

    [[nodiscard]] core::Result<std::vector<TokenId>> encode(std::string_view text) const override;
    [[nodiscard]] core::Result<std::string> decode(std::span<const TokenId> tokens, bool skipSpecialTokens) const override;
    [[nodiscard]] core::Result<TokenId> tokenToId(std::string_view token) const override;
    [[nodiscard]] std::int32_t vocabSize() const noexcept override;
    [[nodiscard]] bool isSpecialToken(TokenId token) const noexcept override;

private:
    struct MergeRank {
        std::int32_t rank;
    };

    HuggingFaceTokenizer(
        std::shared_ptr<const unicode::CodePointClassifier> classifier,
        PreTokenizer preTokenizer,
        std::unordered_map<std::string, TokenId> vocab,
        std::vector<std::string> idToToken,
        std::unordered_map<std::string, std::int32_t> mergeRanks,
        std::vector<SpecialTokenEntry> specialTokens);

    [[nodiscard]] core::Result<void> encodePiece(std::string_view piece, std::vector<TokenId>& output) const;
    [[nodiscard]] std::vector<std::string> applyMerges(std::vector<std::string> symbols) const;

    std::shared_ptr<const unicode::CodePointClassifier> classifier_;
    ByteLevelCodec byteLevel_;
    PreTokenizer preTokenizer_;
    std::unordered_map<std::string, TokenId> vocab_;
    std::vector<std::string> idToToken_;
    std::unordered_map<std::string, std::int32_t> mergeRanks_;
    std::vector<SpecialTokenEntry> specialTokens_;
    std::unordered_map<TokenId, bool> specialTokenIds_;
};

}
