#pragma once

#include <array>
#include <cstdint>
#include <optional>
#include <string>
#include <unordered_map>

namespace eversoul::tokenizer {

class ByteLevelCodec {
public:
    ByteLevelCodec();

    [[nodiscard]] std::string encodeBytes(std::string_view rawBytes) const;
    [[nodiscard]] std::optional<std::uint8_t> decodeCharacter(char32_t codePoint) const;

    [[nodiscard]] char32_t characterForByte(std::uint8_t byte) const noexcept { return byteToChar_[byte]; }

private:
    std::array<char32_t, 256> byteToChar_{};
    std::unordered_map<char32_t, std::uint8_t> charToByte_;
};

}
