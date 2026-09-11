#include "eversoul/tokenizer/byte_level.h"

#include "eversoul/unicode/code_point_category.h"

namespace eversoul::tokenizer {
namespace {

constexpr char32_t kPrintableRange0First = U'!';
constexpr char32_t kPrintableRange0Last = U'~';
constexpr char32_t kPrintableRange1First = 0xA1;
constexpr char32_t kPrintableRange1Last = 0xAC;
constexpr char32_t kPrintableRange2First = 0xAE;
constexpr char32_t kPrintableRange2Last = 0xFF;

bool isDirectlyPrintable(std::uint32_t byte) noexcept {
    return (byte >= kPrintableRange0First && byte <= kPrintableRange0Last)
        || (byte >= kPrintableRange1First && byte <= kPrintableRange1Last)
        || (byte >= kPrintableRange2First && byte <= kPrintableRange2Last);
}

}

ByteLevelCodec::ByteLevelCodec() {
    char32_t nextSpare = 0x100;
    for (std::uint32_t byte = 0; byte < 256; ++byte) {
        char32_t character = 0;
        if (isDirectlyPrintable(byte)) {
            character = static_cast<char32_t>(byte);
        }
        else {
            character = nextSpare++;
        }
        byteToChar_[byte] = character;
        charToByte_.emplace(character, static_cast<std::uint8_t>(byte));
    }
}

std::string ByteLevelCodec::encodeBytes(std::string_view rawBytes) const {
    std::string encoded;
    encoded.reserve(rawBytes.size() * 2);
    for (const char rawByte : rawBytes) {
        unicode::appendUtf8(byteToChar_[static_cast<std::uint8_t>(rawByte)], encoded);
    }
    return encoded;
}

std::optional<std::uint8_t> ByteLevelCodec::decodeCharacter(char32_t codePoint) const {
    const auto match = charToByte_.find(codePoint);
    if (match == charToByte_.end()) {
        return std::nullopt;
    }
    return match->second;
}

}
