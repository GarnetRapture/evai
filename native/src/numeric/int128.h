#pragma once

#include <compare>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>

namespace eversoul::native::numeric {

class UInt128 {
public:
    constexpr UInt128() noexcept = default;
    constexpr UInt128(std::uint64_t high, std::uint64_t low) noexcept : high_(high), low_(low) {}
    constexpr explicit UInt128(std::uint64_t value) noexcept : low_(value) {}

    [[nodiscard]] constexpr std::uint64_t high() const noexcept { return high_; }
    [[nodiscard]] constexpr std::uint64_t low() const noexcept { return low_; }
    [[nodiscard]] constexpr bool isZero() const noexcept { return high_ == 0 && low_ == 0; }
    [[nodiscard]] constexpr bool fitsUInt64() const noexcept { return high_ == 0; }
    [[nodiscard]] constexpr bool bit(unsigned index) const noexcept {
        return index < 64 ? ((low_ >> index) & 1U) != 0 : ((high_ >> (index - 64)) & 1U) != 0;
    }

    friend constexpr bool operator==(const UInt128&, const UInt128&) noexcept = default;
    friend constexpr std::strong_ordering operator<=>(const UInt128& left, const UInt128& right) noexcept {
        if (left.high_ != right.high_) return left.high_ <=> right.high_;
        return left.low_ <=> right.low_;
    }

private:
    std::uint64_t high_ = 0;
    std::uint64_t low_ = 0;
};

class Int128 {
public:
    constexpr Int128() noexcept = default;
    constexpr explicit Int128(std::int64_t value) noexcept
        : bits_(value < 0 ? ~std::uint64_t{0} : 0, static_cast<std::uint64_t>(value)) {}
    constexpr explicit Int128(UInt128 bits) noexcept : bits_(bits) {}

    [[nodiscard]] constexpr UInt128 bits() const noexcept { return bits_; }
    [[nodiscard]] constexpr bool isNegative() const noexcept { return (bits_.high() >> 63U) != 0; }
    [[nodiscard]] constexpr bool isZero() const noexcept { return bits_.isZero(); }

    friend constexpr bool operator==(const Int128&, const Int128&) noexcept = default;
    friend constexpr std::strong_ordering operator<=>(const Int128& left, const Int128& right) noexcept {
        if (left.isNegative() != right.isNegative()) return left.isNegative() ? std::strong_ordering::less : std::strong_ordering::greater;
        return left.bits_ <=> right.bits_;
    }

private:
    UInt128 bits_;
};

[[nodiscard]] constexpr UInt128 uint128Maximum() noexcept { return {~std::uint64_t{0}, ~std::uint64_t{0}}; }
[[nodiscard]] constexpr Int128 int128Maximum() noexcept { return Int128(UInt128{0x7FFFFFFFFFFFFFFFULL, ~std::uint64_t{0}}); }
[[nodiscard]] constexpr Int128 int128Minimum() noexcept { return Int128(UInt128{0x8000000000000000ULL, 0}); }

[[nodiscard]] UInt128 wrappingAdd(UInt128 left, UInt128 right) noexcept;
[[nodiscard]] UInt128 wrappingSubtract(UInt128 left, UInt128 right) noexcept;
[[nodiscard]] UInt128 wrappingMultiply(UInt128 left, UInt128 right) noexcept;
[[nodiscard]] UInt128 wrappingNegate(UInt128 value) noexcept;
[[nodiscard]] UInt128 shiftLeft(UInt128 value, unsigned count) noexcept;
[[nodiscard]] UInt128 shiftRight(UInt128 value, unsigned count) noexcept;
[[nodiscard]] unsigned bitWidth(UInt128 value) noexcept;

struct UInt128Division {
    UInt128 quotient;
    UInt128 remainder;
};

[[nodiscard]] UInt128Division divideUnsigned(UInt128 dividend, UInt128 divisor) noexcept;
[[nodiscard]] std::optional<UInt128> checkedAddUnsigned(UInt128 left, UInt128 right) noexcept;
[[nodiscard]] std::optional<UInt128> checkedMultiplyUnsigned(UInt128 left, UInt128 right) noexcept;

[[nodiscard]] std::optional<Int128> checkedAdd(Int128 left, Int128 right) noexcept;
[[nodiscard]] std::optional<Int128> checkedSubtract(Int128 left, Int128 right) noexcept;
[[nodiscard]] std::optional<Int128> checkedMultiply(Int128 left, Int128 right) noexcept;
[[nodiscard]] std::optional<Int128> checkedDivideEuclid(Int128 left, Int128 right) noexcept;
[[nodiscard]] std::optional<Int128> checkedRemainderEuclid(Int128 left, Int128 right) noexcept;
[[nodiscard]] std::optional<Int128> checkedPower(Int128 base, std::uint32_t exponent) noexcept;
[[nodiscard]] std::optional<Int128> checkedAbsolute(Int128 value) noexcept;
[[nodiscard]] std::optional<Int128> checkedNegate(Int128 value) noexcept;
[[nodiscard]] Int128 truncatingRemainder(Int128 left, Int128 right) noexcept;

[[nodiscard]] std::optional<std::int64_t> toInt64(Int128 value) noexcept;
[[nodiscard]] std::optional<std::uint64_t> toUInt64(Int128 value) noexcept;
[[nodiscard]] std::optional<Int128> toInt128(UInt128 value) noexcept;
[[nodiscard]] std::optional<UInt128> toUInt128(Int128 value) noexcept;

[[nodiscard]] double toDouble(UInt128 value) noexcept;
[[nodiscard]] double toDouble(Int128 value) noexcept;
[[nodiscard]] Int128 saturatingInt128FromDouble(double value) noexcept;

[[nodiscard]] std::optional<UInt128> parseUInt128(std::string_view digits, unsigned radix) noexcept;
[[nodiscard]] std::optional<Int128> parseInt128(std::string_view text) noexcept;
[[nodiscard]] std::string toDecimalString(UInt128 value);
[[nodiscard]] std::string toDecimalString(Int128 value);

}
