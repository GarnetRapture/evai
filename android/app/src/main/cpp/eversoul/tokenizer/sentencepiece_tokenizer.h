#pragma once

#include <array>
#include <cstdint>
#include <memory>
#include <span>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

#include "eversoul/core/failure.h"
#include "eversoul/format/byte_reader.h"
#include "eversoul/tokenizer/sentencepiece_model.h"
#include "eversoul/tokenizer/tokenizer.h"

namespace eversoul::tokenizer {

class SentencePieceTokenizer final : public Tokenizer {
public:
    [[nodiscard]] static core::Result<std::unique_ptr<SentencePieceTokenizer>> create(format::ByteSpan modelBytes);

    [[nodiscard]] core::Result<std::vector<TokenId>> encode(std::string_view text) const override;
    [[nodiscard]] core::Result<std::string> decode(std::span<const TokenId> tokens, bool skipSpecialTokens) const override;
    [[nodiscard]] core::Result<TokenId> tokenToId(std::string_view token) const override;
    [[nodiscard]] std::int32_t vocabSize() const noexcept override;
    [[nodiscard]] bool isSpecialToken(TokenId token) const noexcept override;

private:
    explicit SentencePieceTokenizer(SentencePieceModel model);

    [[nodiscard]] std::string normalize(std::string_view text) const;
    [[nodiscard]] core::Result<std::vector<TokenId>> viterbiEncode(std::string_view normalized) const;

    SentencePieceModel model_;
    std::unordered_map<std::string, TokenId> pieceToId_;
    std::size_t maxPieceBytes_ = 1;
    TokenId unknownId_ = 0;
    std::array<TokenId, 256> byteTokenId_{};
    bool hasByteTokens_ = false;
};

}
