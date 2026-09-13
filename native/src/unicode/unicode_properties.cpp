#include "unicode/unicode_properties.h"

#include <algorithm>
#include <array>
#include <bit>
#include <cstddef>
#include <cstdint>

#include "unicode/unicode_tables.h"

namespace eversoul::native::unicode {
namespace {

constexpr std::uint32_t kPrefixSumMask = (1U << 21U) - 1U;
constexpr std::uint32_t kMultiMappingMask = 0x400000U;

template <std::size_t RunCount, std::size_t OffsetCount>
bool skipSearch(
    std::uint32_t needle,
    const std::array<std::uint32_t, RunCount>& shortOffsetRuns,
    const std::array<std::uint8_t, OffsetCount>& offsets) noexcept {
    const std::uint32_t key = needle << 11U;
    const auto position = std::ranges::lower_bound(shortOffsetRuns, key, {}, [](std::uint32_t header) {
        return header << 11U;
    });
    std::size_t lastIndex = static_cast<std::size_t>(position - shortOffsetRuns.begin());
    if (position != shortOffsetRuns.end() && (*position << 11U) == key) ++lastIndex;
    std::size_t offsetIndex = shortOffsetRuns[lastIndex] >> 21U;
    const std::size_t length = lastIndex + 1 < RunCount
        ? (shortOffsetRuns[lastIndex + 1] >> 21U) - offsetIndex
        : OffsetCount - offsetIndex;
    const std::uint32_t previous = lastIndex > 0 ? shortOffsetRuns[lastIndex - 1] & kPrefixSumMask : 0U;
    const std::uint32_t total = needle - previous;
    std::uint32_t prefixSum = 0;
    for (std::size_t step = 0; step + 1 < length; ++step) {
        prefixSum += offsets[offsetIndex];
        if (prefixSum > total) break;
        ++offsetIndex;
    }
    return offsetIndex % 2 == 1;
}

template <std::size_t ChunkMapCount, std::size_t IndexChunkCount, std::size_t CanonicalCount, std::size_t MappingCount>
bool bitsetSearch(
    std::uint32_t needle,
    const std::array<std::uint8_t, ChunkMapCount>& chunkIndexMap,
    const std::array<std::array<std::uint8_t, 16>, IndexChunkCount>& bitsetChunkIndex,
    const std::array<std::uint64_t, CanonicalCount>& bitsetCanonical,
    const std::array<UnicodeBitsetMapping, MappingCount>& bitsetCanonicalized) noexcept {
    const std::size_t bucketIndex = needle / 64U;
    const std::size_t chunkMapIndex = bucketIndex / 16U;
    const std::size_t chunkPiece = bucketIndex % 16U;
    if (chunkMapIndex >= ChunkMapCount) return false;
    const std::size_t chunkIndex = chunkIndexMap[chunkMapIndex];
    const std::size_t index = bitsetChunkIndex[chunkIndex][chunkPiece];
    std::uint64_t word = 0;
    if (index < CanonicalCount) {
        word = bitsetCanonical[index];
    }
    else {
        const UnicodeBitsetMapping mapping = bitsetCanonicalized[index - CanonicalCount];
        word = bitsetCanonical[mapping.canonicalIndex];
        if ((mapping.transformation & (1U << 6U)) != 0) word = ~word;
        const unsigned quantity = mapping.transformation & ((1U << 6U) - 1U);
        if ((mapping.transformation & (1U << 7U)) != 0) word >>= quantity;
        else word = std::rotl(word, static_cast<int>(quantity));
    }
    return (word & (std::uint64_t{1} << (needle % 64U))) != 0;
}

template <std::size_t TableCount, std::size_t MultiCount>
UnicodeCaseMappingResult caseMapping(
    char32_t codePoint,
    const std::array<UnicodeCaseMapping, TableCount>& table,
    const std::array<std::array<char32_t, 3>, MultiCount>& multiTable) noexcept {
    const auto position = std::ranges::lower_bound(table, codePoint, {}, &UnicodeCaseMapping::codePoint);
    if (position == table.end() || position->codePoint != codePoint) return {codePoint, U'\0', U'\0'};
    const std::uint32_t mapping = position->mapping;
    if (mapping <= 0x10FFFFU && (mapping < 0xD800U || mapping > 0xDFFFU)) {
        return {static_cast<char32_t>(mapping), U'\0', U'\0'};
    }
    return multiTable[mapping & (kMultiMappingMask - 1U)];
}

template <std::size_t UpperCount, std::size_t LowerCount, std::size_t NormalCount>
bool printableCheck(
    std::uint16_t value,
    const std::array<UnicodeSingletonRun, UpperCount>& singletonUppers,
    const std::array<std::uint8_t, LowerCount>& singletonLowers,
    const std::array<std::uint8_t, NormalCount>& normal) noexcept {
    const auto upper = static_cast<std::uint8_t>(value >> 8U);
    std::size_t lowerStart = 0;
    for (const UnicodeSingletonRun& run : singletonUppers) {
        const std::size_t lowerEnd = lowerStart + run.lowerCount;
        if (upper == run.upper) {
            for (std::size_t index = lowerStart; index < lowerEnd; ++index) {
                if (singletonLowers[index] == static_cast<std::uint8_t>(value)) return false;
            }
        }
        else if (upper < run.upper) {
            break;
        }
        lowerStart = lowerEnd;
    }
    std::int32_t remaining = value;
    bool current = true;
    for (std::size_t index = 0; index < NormalCount; ++index) {
        const std::uint8_t lead = normal[index];
        std::int32_t length = lead;
        if ((lead & 0x80U) != 0) {
            length = (static_cast<std::int32_t>(lead & 0x7FU) << 8) | normal[++index];
        }
        remaining -= length;
        if (remaining < 0) break;
        current = !current;
    }
    return current;
}

bool whiteSpaceLookup(char32_t codePoint) noexcept {
    const std::uint32_t value = codePoint;
    switch (value >> 8U) {
    case 0: return (white_space_table::kWhitespaceMap[value & 0xFFU] & 1U) != 0;
    case 22: return value == 0x1680U;
    case 32: return (white_space_table::kWhitespaceMap[value & 0xFFU] & 2U) != 0;
    case 48: return value == 0x3000U;
    default: return false;
    }
}

}

bool isWhitespace(char32_t codePoint) noexcept {
    if (codePoint == U' ' || (codePoint >= U'\x09' && codePoint <= U'\x0d')) return true;
    return codePoint > U'\x7f' && whiteSpaceLookup(codePoint);
}

bool isLowercase(char32_t codePoint) noexcept {
    if (codePoint >= U'a' && codePoint <= U'z') return true;
    return codePoint > U'\x7f' && bitsetSearch(codePoint, lowercase_table::kBitsetChunksMap,
        lowercase_table::kBitsetIndexChunks, lowercase_table::kBitsetCanonical, lowercase_table::kBitsetMapping);
}

bool isUppercase(char32_t codePoint) noexcept {
    if (codePoint >= U'A' && codePoint <= U'Z') return true;
    return codePoint > U'\x7f' && bitsetSearch(codePoint, uppercase_table::kBitsetChunksMap,
        uppercase_table::kBitsetIndexChunks, uppercase_table::kBitsetCanonical, uppercase_table::kBitsetMapping);
}

bool isAlphabetic(char32_t codePoint) noexcept {
    if ((codePoint >= U'a' && codePoint <= U'z') || (codePoint >= U'A' && codePoint <= U'Z')) return true;
    return codePoint > U'\x7f' && skipSearch(codePoint, alphabetic_table::kShortOffsetRuns, alphabetic_table::kOffsets);
}

bool isNumeric(char32_t codePoint) noexcept {
    if (codePoint >= U'0' && codePoint <= U'9') return true;
    return codePoint > U'\x7f' && skipSearch(codePoint, n_table::kShortOffsetRuns, n_table::kOffsets);
}

bool isAlphanumeric(char32_t codePoint) noexcept {
    return isAlphabetic(codePoint) || isNumeric(codePoint);
}

bool isControl(char32_t codePoint) noexcept {
    return skipSearch(codePoint, cc_table::kShortOffsetRuns, cc_table::kOffsets);
}

bool isGraphemeExtended(char32_t codePoint) noexcept {
    return codePoint >= 0x300U && skipSearch(codePoint, grapheme_extend_table::kShortOffsetRuns, grapheme_extend_table::kOffsets);
}

bool hasCasedProperty(char32_t codePoint) noexcept {
    return skipSearch(codePoint, cased_table::kShortOffsetRuns, cased_table::kOffsets);
}

bool hasCaseIgnorableProperty(char32_t codePoint) noexcept {
    return skipSearch(codePoint, case_ignorable_table::kShortOffsetRuns, case_ignorable_table::kOffsets);
}

bool isAsciiWhitespace(char32_t codePoint) noexcept {
    return codePoint == U'\t' || codePoint == U'\n' || codePoint == U'\x0C' || codePoint == U'\r' || codePoint == U' ';
}

bool isAsciiPunctuation(char32_t codePoint) noexcept {
    return (codePoint >= U'!' && codePoint <= U'/') || (codePoint >= U':' && codePoint <= U'@')
        || (codePoint >= U'[' && codePoint <= U'`') || (codePoint >= U'{' && codePoint <= U'~');
}

bool isPrintable(char32_t codePoint) noexcept {
    const std::uint32_t value = codePoint;
    if (value < 32U) return false;
    if (value < 127U) return true;
    const auto lower = static_cast<std::uint16_t>(value);
    if (value < 0x10000U) {
        return printableCheck(lower, printable_table::kSingletons0u, printable_table::kSingletons0l, printable_table::kNormal0);
    }
    if (value < 0x20000U) {
        return printableCheck(lower, printable_table::kSingletons1u, printable_table::kSingletons1l, printable_table::kNormal1);
    }
    constexpr std::array<std::array<std::uint32_t, 2>, 10> nonPrintableRanges{{
        {0x2a6e0U, 0x2a700U}, {0x2b73aU, 0x2b740U}, {0x2b81eU, 0x2b820U}, {0x2cea2U, 0x2ceb0U},
        {0x2ebe1U, 0x2ebf0U}, {0x2ee5eU, 0x2f800U}, {0x2fa1eU, 0x30000U}, {0x3134bU, 0x31350U},
        {0x323b0U, 0xe0100U}, {0xe01f0U, 0x110000U},
    }};
    return std::ranges::none_of(nonPrintableRanges, [value](const std::array<std::uint32_t, 2>& range) {
        return range[0] <= value && value < range[1];
    });
}

UnicodeCaseMappingResult lowercaseMapping(char32_t codePoint) noexcept {
    if (codePoint < 0x80U) {
        return {codePoint >= U'A' && codePoint <= U'Z' ? codePoint + 32U : codePoint, U'\0', U'\0'};
    }
    return caseMapping(codePoint, conversions_table::kLowercaseTable, conversions_table::kLowercaseTableMulti);
}

UnicodeCaseMappingResult uppercaseMapping(char32_t codePoint) noexcept {
    if (codePoint < 0x80U) {
        return {codePoint >= U'a' && codePoint <= U'z' ? codePoint - 32U : codePoint, U'\0', U'\0'};
    }
    return caseMapping(codePoint, conversions_table::kUppercaseTable, conversions_table::kUppercaseTableMulti);
}

}
