#include "eversoul/unicode/code_point_category.h"

#include <array>

namespace eversoul::unicode {
namespace {

constexpr char32_t kMaxCodePoint = 0x10FFFF;
constexpr char32_t kSurrogateFirst = 0xD800;
constexpr char32_t kSurrogateLast = 0xDFFF;

constexpr std::uint8_t kContinuationMask = 0xC0;
constexpr std::uint8_t kContinuationTag = 0x80;

struct Utf8LeadRange {
    std::uint8_t leadMask;
    std::uint8_t leadTag;
    std::uint8_t continuationBytes;
    char32_t minValue;
};

constexpr std::array<Utf8LeadRange, 4> kLeadRanges = {{
    {0x80, 0x00, 0, 0x0},
    {0xE0, 0xC0, 1, 0x80},
    {0xF0, 0xE0, 2, 0x800},
    {0xF8, 0xF0, 3, 0x10000},
}};

}

core::Result<std::vector<char32_t>> decodeUtf8(std::string_view text) {
    std::vector<char32_t> codePoints;
    codePoints.reserve(text.size());
    std::size_t index = 0;
    while (index < text.size()) {
        const auto lead = static_cast<std::uint8_t>(text[index]);
        const Utf8LeadRange* match = nullptr;
        for (const Utf8LeadRange& range : kLeadRanges) {
            if ((lead & range.leadMask) == range.leadTag) {
                match = &range;
                break;
            }
        }
        if (match == nullptr) {
            return core::fail(core::FailureCode::NativeRuntime, "utf8_invalid_lead_byte");
        }
        if (match->continuationBytes > text.size() - index - 1) {
            return core::fail(core::FailureCode::NativeRuntime, "utf8_truncated_sequence");
        }
        char32_t codePoint = lead & static_cast<std::uint8_t>(~match->leadMask);
        for (std::uint8_t offset = 1; offset <= match->continuationBytes; ++offset) {
            const auto continuation = static_cast<std::uint8_t>(text[index + offset]);
            if ((continuation & kContinuationMask) != kContinuationTag) {
                return core::fail(core::FailureCode::NativeRuntime, "utf8_invalid_continuation");
            }
            codePoint = (codePoint << 6) | static_cast<char32_t>(continuation & 0x3F);
        }
        if (codePoint < match->minValue || codePoint > kMaxCodePoint || (codePoint >= kSurrogateFirst && codePoint <= kSurrogateLast)) {
            return core::fail(core::FailureCode::NativeRuntime, "utf8_invalid_code_point");
        }
        codePoints.push_back(codePoint);
        index += static_cast<std::size_t>(match->continuationBytes) + 1;
    }
    return codePoints;
}

void appendUtf8(char32_t codePoint, std::string& out) {
    if (codePoint <= 0x7F) {
        out.push_back(static_cast<char>(codePoint));
    }
    else if (codePoint <= 0x7FF) {
        out.push_back(static_cast<char>(0xC0 | (codePoint >> 6)));
        out.push_back(static_cast<char>(kContinuationTag | (codePoint & 0x3F)));
    }
    else if (codePoint <= 0xFFFF) {
        out.push_back(static_cast<char>(0xE0 | (codePoint >> 12)));
        out.push_back(static_cast<char>(kContinuationTag | ((codePoint >> 6) & 0x3F)));
        out.push_back(static_cast<char>(kContinuationTag | (codePoint & 0x3F)));
    }
    else {
        out.push_back(static_cast<char>(0xF0 | (codePoint >> 18)));
        out.push_back(static_cast<char>(kContinuationTag | ((codePoint >> 12) & 0x3F)));
        out.push_back(static_cast<char>(kContinuationTag | ((codePoint >> 6) & 0x3F)));
        out.push_back(static_cast<char>(kContinuationTag | (codePoint & 0x3F)));
    }
}

bool isAsciiWhitespace(char32_t codePoint) noexcept {
    return codePoint == U' ' || codePoint == U'\t' || codePoint == U'\n' || codePoint == U'\r' || codePoint == 0x0B || codePoint == 0x0C;
}

}
