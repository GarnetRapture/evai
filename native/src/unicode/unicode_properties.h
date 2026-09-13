#pragma once

#include <array>

namespace eversoul::native::unicode {

using UnicodeCaseMappingResult = std::array<char32_t, 3>;

[[nodiscard]] bool isWhitespace(char32_t codePoint) noexcept;
[[nodiscard]] bool isLowercase(char32_t codePoint) noexcept;
[[nodiscard]] bool isUppercase(char32_t codePoint) noexcept;
[[nodiscard]] bool isAlphabetic(char32_t codePoint) noexcept;
[[nodiscard]] bool isNumeric(char32_t codePoint) noexcept;
[[nodiscard]] bool isAlphanumeric(char32_t codePoint) noexcept;
[[nodiscard]] bool isControl(char32_t codePoint) noexcept;
[[nodiscard]] bool isGraphemeExtended(char32_t codePoint) noexcept;
[[nodiscard]] bool hasCasedProperty(char32_t codePoint) noexcept;
[[nodiscard]] bool hasCaseIgnorableProperty(char32_t codePoint) noexcept;
[[nodiscard]] bool isAsciiWhitespace(char32_t codePoint) noexcept;
[[nodiscard]] bool isAsciiPunctuation(char32_t codePoint) noexcept;
[[nodiscard]] bool isPrintable(char32_t codePoint) noexcept;
[[nodiscard]] UnicodeCaseMappingResult lowercaseMapping(char32_t codePoint) noexcept;
[[nodiscard]] UnicodeCaseMappingResult uppercaseMapping(char32_t codePoint) noexcept;

}
