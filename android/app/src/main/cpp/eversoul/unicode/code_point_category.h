#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

#include "eversoul/core/failure.h"

namespace eversoul::unicode {

enum class CodePointCategory : std::uint8_t {
    Other,
    Letter,
    Number,
    Whitespace,
};

class CodePointClassifier {
public:
    virtual ~CodePointClassifier() = default;
    [[nodiscard]] virtual CodePointCategory categoryOf(char32_t codePoint) const = 0;
};

[[nodiscard]] core::Result<std::vector<char32_t>> decodeUtf8(std::string_view text);
void appendUtf8(char32_t codePoint, std::string& out);
[[nodiscard]] bool isAsciiWhitespace(char32_t codePoint) noexcept;

}
