#pragma once

#include <cstdint>
#include <span>
#include <string>
#include <vector>

#include "eversoul/core/failure.h"

namespace eversoul::tokenizer {

using TokenId = std::int32_t;

class Tokenizer {
public:
    virtual ~Tokenizer() = default;

    [[nodiscard]] virtual core::Result<std::vector<TokenId>> encode(std::string_view text) const = 0;
    [[nodiscard]] virtual core::Result<std::string> decode(std::span<const TokenId> tokens, bool skipSpecialTokens) const = 0;
    [[nodiscard]] virtual core::Result<TokenId> tokenToId(std::string_view token) const = 0;
    [[nodiscard]] virtual std::int32_t vocabSize() const noexcept = 0;
    [[nodiscard]] virtual bool isSpecialToken(TokenId token) const noexcept = 0;
};

}
