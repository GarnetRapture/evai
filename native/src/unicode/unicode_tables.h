#pragma once

#include <array>
#include <cstdint>

namespace eversoul::native::unicode {

struct UnicodeCaseMapping {
    char32_t codePoint;
    std::uint32_t mapping;
};

struct UnicodeSingletonRun {
    std::uint8_t upper;
    std::uint8_t lowerCount;
};

struct UnicodeBitsetMapping {
    std::uint8_t canonicalIndex;
    std::uint8_t transformation;
};

namespace alphabetic_table {
extern const std::array<std::uint32_t, 53> kShortOffsetRuns;
extern const std::array<std::uint8_t, 1515> kOffsets;
}

namespace case_ignorable_table {
extern const std::array<std::uint32_t, 37> kShortOffsetRuns;
extern const std::array<std::uint8_t, 905> kOffsets;
}

namespace cased_table {
extern const std::array<std::uint32_t, 22> kShortOffsetRuns;
extern const std::array<std::uint8_t, 319> kOffsets;
}

namespace cc_table {
extern const std::array<std::uint32_t, 1> kShortOffsetRuns;
extern const std::array<std::uint8_t, 5> kOffsets;
}

namespace grapheme_extend_table {
extern const std::array<std::uint32_t, 34> kShortOffsetRuns;
extern const std::array<std::uint8_t, 751> kOffsets;
}

namespace lowercase_table {
extern const std::array<std::uint8_t, 123> kBitsetChunksMap;
extern const std::array<std::array<std::uint8_t, 16>, 20> kBitsetIndexChunks;
extern const std::array<std::uint64_t, 56> kBitsetCanonical;
extern const std::array<UnicodeBitsetMapping, 22> kBitsetMapping;
}

namespace n_table {
extern const std::array<std::uint32_t, 42> kShortOffsetRuns;
extern const std::array<std::uint8_t, 289> kOffsets;
}

namespace uppercase_table {
extern const std::array<std::uint8_t, 125> kBitsetChunksMap;
extern const std::array<std::array<std::uint8_t, 16>, 17> kBitsetIndexChunks;
extern const std::array<std::uint64_t, 44> kBitsetCanonical;
extern const std::array<UnicodeBitsetMapping, 25> kBitsetMapping;
}

namespace white_space_table {
extern const std::array<std::uint8_t, 256> kWhitespaceMap;
}

namespace conversions_table {
extern const std::array<UnicodeCaseMapping, 1434> kLowercaseTable;
extern const std::array<std::array<char32_t, 3>, 1> kLowercaseTableMulti;
extern const std::array<UnicodeCaseMapping, 1526> kUppercaseTable;
extern const std::array<std::array<char32_t, 3>, 102> kUppercaseTableMulti;
}

namespace printable_table {
extern const std::array<UnicodeSingletonRun, 40> kSingletons0u;
extern const std::array<std::uint8_t, 290> kSingletons0l;
extern const std::array<UnicodeSingletonRun, 44> kSingletons1u;
extern const std::array<std::uint8_t, 208> kSingletons1l;
extern const std::array<std::uint8_t, 297> kNormal0;
extern const std::array<std::uint8_t, 486> kNormal1;
}

}
