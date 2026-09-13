#include "unicode/utf8_text.h"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "unicode/unicode_properties.h"

namespace eversoul::native::unicode {
namespace {

constexpr char32_t kCapitalSigma = 0x3A3;
constexpr char32_t kSmallSigma = 0x3C3;
constexpr char32_t kFinalSigma = 0x3C2;

class PatternMatcher {
public:
    PatternMatcher(std::string_view text, std::string_view pattern) noexcept : text_(text), pattern_(pattern) {}

    [[nodiscard]] std::optional<std::pair<std::size_t, std::size_t>> nextMatch() noexcept {
        if (pattern_.empty()) {
            if (emptyFinished_) return std::nullopt;
            const std::size_t position = position_;
            if (position >= text_.size()) {
                emptyFinished_ = true;
                return std::pair{position, position};
            }
            position_ += decodeCodePointAt(text_, position).byteLength;
            return std::pair{position, position};
        }
        if (position_ > text_.size()) return std::nullopt;
        const std::size_t found = text_.find(pattern_, position_);
        if (found == std::string_view::npos) {
            position_ = text_.size() + 1;
            return std::nullopt;
        }
        position_ = found + pattern_.size();
        return std::pair{found, found + pattern_.size()};
    }

private:
    std::string_view text_;
    std::string_view pattern_;
    std::size_t position_ = 0;
    bool emptyFinished_ = false;
};

class PatternSplitter {
public:
    PatternSplitter(std::string_view text, std::string_view pattern) noexcept : text_(text), matcher_(text, pattern) {}

    [[nodiscard]] std::optional<std::string_view> end() noexcept {
        if (finished_) return std::nullopt;
        finished_ = true;
        return text_.substr(start_);
    }

    [[nodiscard]] std::optional<std::string_view> next() noexcept {
        if (finished_) return std::nullopt;
        if (const auto match = matcher_.nextMatch()) {
            const std::string_view piece = text_.substr(start_, match->first - start_);
            start_ = match->second;
            return piece;
        }
        return end();
    }

private:
    std::string_view text_;
    PatternMatcher matcher_;
    std::size_t start_ = 0;
    bool finished_ = false;
};

bool containsCodePoint(std::u32string_view set, char32_t codePoint) noexcept {
    return set.find(codePoint) != std::u32string_view::npos;
}

bool caseIgnorableThenCasedForward(std::string_view text, std::size_t offset) noexcept {
    while (offset < text.size()) {
        const Utf8CodePoint decoded = decodeCodePointAt(text, offset);
        if (!hasCaseIgnorableProperty(decoded.codePoint)) return hasCasedProperty(decoded.codePoint);
        offset += decoded.byteLength;
    }
    return false;
}

bool caseIgnorableThenCasedBackward(std::string_view text, std::size_t end) noexcept {
    while (end > 0) {
        const Utf8CodePoint decoded = decodeCodePointBefore(text, end);
        if (!hasCaseIgnorableProperty(decoded.codePoint)) return hasCasedProperty(decoded.codePoint);
        end -= decoded.byteLength;
    }
    return false;
}

void appendMapping(std::string& output, const UnicodeCaseMappingResult& mapping) {
    appendUtf8(output, mapping[0]);
    if (mapping[1] == U'\0') return;
    appendUtf8(output, mapping[1]);
    if (mapping[2] != U'\0') appendUtf8(output, mapping[2]);
}

}

bool isValidUtf8(std::string_view text) noexcept {
    std::size_t index = 0;
    while (index < text.size()) {
        const auto lead = static_cast<unsigned char>(text[index]);
        if (lead < 0x80U) {
            ++index;
            continue;
        }
        std::size_t length = 0;
        char32_t minimum = 0;
        if (lead >= 0xC2U && lead <= 0xDFU) { length = 2; minimum = 0x80; }
        else if (lead >= 0xE0U && lead <= 0xEFU) { length = 3; minimum = 0x800; }
        else if (lead >= 0xF0U && lead <= 0xF4U) { length = 4; minimum = 0x10000; }
        else return false;
        if (index + length > text.size()) return false;
        char32_t codePoint = lead & (0xFFU >> (length + 1));
        for (std::size_t continuation = 1; continuation < length; ++continuation) {
            const auto byte = static_cast<unsigned char>(text[index + continuation]);
            if ((byte & 0xC0U) != 0x80U) return false;
            codePoint = (codePoint << 6U) | (byte & 0x3FU);
        }
        if (codePoint < minimum || codePoint > 0x10FFFFU || (codePoint >= 0xD800U && codePoint <= 0xDFFFU)) return false;
        index += length;
    }
    return true;
}

Utf8CodePoint decodeCodePointAt(std::string_view text, std::size_t offset) noexcept {
    const auto lead = static_cast<unsigned char>(text[offset]);
    if (lead < 0x80U) return {lead, 1};
    std::size_t length = lead >= 0xF0U ? 4 : lead >= 0xE0U ? 3 : 2;
    char32_t codePoint = lead & (0xFFU >> (length + 1));
    for (std::size_t continuation = 1; continuation < length; ++continuation) {
        codePoint = (codePoint << 6U) | (static_cast<unsigned char>(text[offset + continuation]) & 0x3FU);
    }
    return {codePoint, length};
}

Utf8CodePoint decodeCodePointBefore(std::string_view text, std::size_t end) noexcept {
    std::size_t start = end - 1;
    while (start > 0 && (static_cast<unsigned char>(text[start]) & 0xC0U) == 0x80U) --start;
    return decodeCodePointAt(text, start);
}

std::size_t utf8Length(char32_t codePoint) noexcept {
    return codePoint < 0x80U ? 1 : codePoint < 0x800U ? 2 : codePoint < 0x10000U ? 3 : 4;
}

void appendUtf8(std::string& output, char32_t codePoint) {
    if (codePoint < 0x80U) {
        output.push_back(static_cast<char>(codePoint));
    }
    else if (codePoint < 0x800U) {
        output.push_back(static_cast<char>(0xC0U | (codePoint >> 6U)));
        output.push_back(static_cast<char>(0x80U | (codePoint & 0x3FU)));
    }
    else if (codePoint < 0x10000U) {
        output.push_back(static_cast<char>(0xE0U | (codePoint >> 12U)));
        output.push_back(static_cast<char>(0x80U | ((codePoint >> 6U) & 0x3FU)));
        output.push_back(static_cast<char>(0x80U | (codePoint & 0x3FU)));
    }
    else {
        output.push_back(static_cast<char>(0xF0U | (codePoint >> 18U)));
        output.push_back(static_cast<char>(0x80U | ((codePoint >> 12U) & 0x3FU)));
        output.push_back(static_cast<char>(0x80U | ((codePoint >> 6U) & 0x3FU)));
        output.push_back(static_cast<char>(0x80U | (codePoint & 0x3FU)));
    }
}

std::string encodeUtf8(char32_t codePoint) {
    std::string output;
    appendUtf8(output, codePoint);
    return output;
}

std::size_t codePointCount(std::string_view text) noexcept {
    return static_cast<std::size_t>(std::ranges::count_if(text, [](char byte) {
        return (static_cast<unsigned char>(byte) & 0xC0U) != 0x80U;
    }));
}

std::u32string decodeUtf8(std::string_view text) {
    std::u32string codePoints;
    codePoints.reserve(text.size());
    for (std::size_t offset = 0; offset < text.size();) {
        const Utf8CodePoint decoded = decodeCodePointAt(text, offset);
        codePoints.push_back(decoded.codePoint);
        offset += decoded.byteLength;
    }
    return codePoints;
}

std::string encodeUtf8(std::u32string_view codePoints) {
    std::string output;
    output.reserve(codePoints.size());
    for (char32_t codePoint : codePoints) appendUtf8(output, codePoint);
    return output;
}

std::string_view trimWhitespaceStart(std::string_view text) noexcept {
    std::size_t offset = 0;
    while (offset < text.size()) {
        const Utf8CodePoint decoded = decodeCodePointAt(text, offset);
        if (!isWhitespace(decoded.codePoint)) break;
        offset += decoded.byteLength;
    }
    return text.substr(offset);
}

std::string_view trimWhitespaceEnd(std::string_view text) noexcept {
    std::size_t end = text.size();
    while (end > 0) {
        const Utf8CodePoint decoded = decodeCodePointBefore(text, end);
        if (!isWhitespace(decoded.codePoint)) break;
        end -= decoded.byteLength;
    }
    return text.substr(0, end);
}

std::string_view trimWhitespace(std::string_view text) noexcept {
    return trimWhitespaceEnd(trimWhitespaceStart(text));
}

std::string_view trimCodePointsStart(std::string_view text, std::u32string_view removable) noexcept {
    std::size_t offset = 0;
    while (offset < text.size()) {
        const Utf8CodePoint decoded = decodeCodePointAt(text, offset);
        if (!containsCodePoint(removable, decoded.codePoint)) break;
        offset += decoded.byteLength;
    }
    return text.substr(offset);
}

std::string_view trimCodePointsEnd(std::string_view text, std::u32string_view removable) noexcept {
    std::size_t end = text.size();
    while (end > 0) {
        const Utf8CodePoint decoded = decodeCodePointBefore(text, end);
        if (!containsCodePoint(removable, decoded.codePoint)) break;
        end -= decoded.byteLength;
    }
    return text.substr(0, end);
}

std::string_view trimCodePoints(std::string_view text, std::u32string_view removable) noexcept {
    return trimCodePointsEnd(trimCodePointsStart(text, removable), removable);
}

std::vector<std::string_view> splitWhitespace(std::string_view text) {
    std::vector<std::string_view> parts;
    std::size_t offset = 0;
    std::size_t start = 0;
    bool inWord = false;
    while (offset < text.size()) {
        const Utf8CodePoint decoded = decodeCodePointAt(text, offset);
        if (isWhitespace(decoded.codePoint)) {
            if (inWord) parts.push_back(text.substr(start, offset - start));
            inWord = false;
        }
        else if (!inWord) {
            start = offset;
            inWord = true;
        }
        offset += decoded.byteLength;
    }
    if (inWord) parts.push_back(text.substr(start));
    return parts;
}

std::vector<std::string_view> splitByPattern(std::string_view text, std::string_view pattern) {
    std::vector<std::string_view> parts;
    PatternSplitter splitter(text, pattern);
    while (const auto piece = splitter.next()) parts.push_back(*piece);
    return parts;
}

std::vector<std::string_view> splitByPatternLimited(std::string_view text, std::size_t limit, std::string_view pattern) {
    std::vector<std::string_view> parts;
    PatternSplitter splitter(text, pattern);
    for (std::size_t count = limit; count > 0; --count) {
        const auto piece = count == 1 ? splitter.end() : splitter.next();
        if (!piece) break;
        parts.push_back(*piece);
    }
    return parts;
}

std::vector<std::string_view> splitLines(std::string_view text) {
    std::vector<std::string_view> lines;
    std::size_t start = 0;
    while (start < text.size()) {
        const std::size_t newline = text.find('\n', start);
        std::string_view line = newline == std::string_view::npos ? text.substr(start) : text.substr(start, newline - start + 1);
        start = newline == std::string_view::npos ? text.size() : newline + 1;
        if (line.ends_with('\n')) {
            line.remove_suffix(1);
            if (line.ends_with('\r')) line.remove_suffix(1);
        }
        lines.push_back(line);
    }
    return lines;
}

std::string replaceAll(std::string_view text, std::string_view from, std::string_view to) {
    std::string result;
    std::size_t lastEnd = 0;
    PatternMatcher matcher(text, from);
    while (const auto match = matcher.nextMatch()) {
        result.append(text.substr(lastEnd, match->first - lastEnd));
        result.append(to);
        lastEnd = match->second;
    }
    result.append(text.substr(lastEnd));
    return result;
}

std::string toLowercase(std::string_view text) {
    std::string output;
    output.reserve(text.size());
    for (std::size_t offset = 0; offset < text.size();) {
        const Utf8CodePoint decoded = decodeCodePointAt(text, offset);
        if (decoded.codePoint == kCapitalSigma) {
            const bool wordFinal = caseIgnorableThenCasedBackward(text, offset)
                && !caseIgnorableThenCasedForward(text, offset + decoded.byteLength);
            appendUtf8(output, wordFinal ? kFinalSigma : kSmallSigma);
        }
        else {
            appendMapping(output, lowercaseMapping(decoded.codePoint));
        }
        offset += decoded.byteLength;
    }
    return output;
}

std::string toUppercase(std::string_view text) {
    std::string output;
    output.reserve(text.size());
    for (std::size_t offset = 0; offset < text.size();) {
        const Utf8CodePoint decoded = decodeCodePointAt(text, offset);
        appendMapping(output, uppercaseMapping(decoded.codePoint));
        offset += decoded.byteLength;
    }
    return output;
}

void appendUnicodeEscape(std::string& output, char32_t codePoint) {
    constexpr std::string_view digits = "0123456789abcdef";
    std::array<char, 8> buffer{};
    std::size_t length = 0;
    std::uint32_t value = codePoint;
    do {
        buffer[length++] = digits[value & 0xFU];
        value >>= 4U;
    } while (value != 0);
    output.append("\\u{");
    while (length > 0) output.push_back(buffer[--length]);
    output.push_back('}');
}

std::string debugEscapedString(std::string_view text) {
    std::string output;
    output.reserve(text.size() + 2);
    output.push_back('"');
    for (std::size_t offset = 0; offset < text.size();) {
        const Utf8CodePoint decoded = decodeCodePointAt(text, offset);
        const char32_t codePoint = decoded.codePoint;
        switch (codePoint) {
        case U'\0': output.append("\\0"); break;
        case U'\t': output.append("\\t"); break;
        case U'\r': output.append("\\r"); break;
        case U'\n': output.append("\\n"); break;
        case U'\\': output.append("\\\\"); break;
        case U'"': output.append("\\\""); break;
        default:
            if (isGraphemeExtended(codePoint) || !isPrintable(codePoint)) appendUnicodeEscape(output, codePoint);
            else output.append(text.substr(offset, decoded.byteLength));
            break;
        }
        offset += decoded.byteLength;
    }
    output.push_back('"');
    return output;
}

}
