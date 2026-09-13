#pragma once

#include <cstddef>
#include <string>
#include <string_view>
#include <vector>

namespace eversoul::native::unicode {

struct Utf8CodePoint {
    char32_t codePoint = U'\0';
    std::size_t byteLength = 0;
};

[[nodiscard]] bool isValidUtf8(std::string_view text) noexcept;
[[nodiscard]] Utf8CodePoint decodeCodePointAt(std::string_view text, std::size_t offset) noexcept;
[[nodiscard]] Utf8CodePoint decodeCodePointBefore(std::string_view text, std::size_t end) noexcept;
[[nodiscard]] std::size_t utf8Length(char32_t codePoint) noexcept;
void appendUtf8(std::string& output, char32_t codePoint);
[[nodiscard]] std::string encodeUtf8(char32_t codePoint);
[[nodiscard]] std::size_t codePointCount(std::string_view text) noexcept;
[[nodiscard]] std::u32string decodeUtf8(std::string_view text);
[[nodiscard]] std::string encodeUtf8(std::u32string_view codePoints);

[[nodiscard]] std::string_view trimWhitespace(std::string_view text) noexcept;
[[nodiscard]] std::string_view trimWhitespaceStart(std::string_view text) noexcept;
[[nodiscard]] std::string_view trimWhitespaceEnd(std::string_view text) noexcept;
[[nodiscard]] std::string_view trimCodePoints(std::string_view text, std::u32string_view removable) noexcept;
[[nodiscard]] std::string_view trimCodePointsStart(std::string_view text, std::u32string_view removable) noexcept;
[[nodiscard]] std::string_view trimCodePointsEnd(std::string_view text, std::u32string_view removable) noexcept;

[[nodiscard]] std::vector<std::string_view> splitWhitespace(std::string_view text);
[[nodiscard]] std::vector<std::string_view> splitByPattern(std::string_view text, std::string_view pattern);
[[nodiscard]] std::vector<std::string_view> splitByPatternLimited(std::string_view text, std::size_t limit, std::string_view pattern);
[[nodiscard]] std::vector<std::string_view> splitLines(std::string_view text);
[[nodiscard]] std::string replaceAll(std::string_view text, std::string_view from, std::string_view to);

[[nodiscard]] std::string toLowercase(std::string_view text);
[[nodiscard]] std::string toUppercase(std::string_view text);
[[nodiscard]] std::string debugEscapedString(std::string_view text);
void appendUnicodeEscape(std::string& output, char32_t codePoint);

}
