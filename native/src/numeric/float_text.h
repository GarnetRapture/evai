#pragma once

#include <cstddef>
#include <optional>
#include <string>

#include "numeric/int128.h"

namespace eversoul::native::numeric {

[[nodiscard]] std::string rustFloatDisplay(double value);
[[nodiscard]] std::string rustFloatDebug(double value);
[[nodiscard]] std::string jsonFloatText(double value);
[[nodiscard]] std::string rustFloatExponential(double magnitude, std::size_t precision);
[[nodiscard]] std::string rustFloatFixed(double magnitude, std::size_t precision);
[[nodiscard]] std::string rustIntegerExponential(UInt128 value, std::optional<std::size_t> precision);
[[nodiscard]] std::string uint128InRadix(UInt128 value, unsigned radix, bool uppercase);

}
