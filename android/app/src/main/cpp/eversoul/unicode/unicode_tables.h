#pragma once

#include <array>
#include <span>

namespace eversoul::unicode {

struct CodePointRange {
    char32_t first;
    char32_t last;
};

[[nodiscard]] std::span<const CodePointRange> letterRanges() noexcept;
[[nodiscard]] std::span<const CodePointRange> numberRanges() noexcept;

}
