#include "numeric/int128.h"

#include <bit>
#include <cmath>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>

namespace eversoul::native::numeric {
namespace {

struct Product64 {
    std::uint64_t high;
    std::uint64_t low;
};

Product64 multiply64(std::uint64_t left, std::uint64_t right) noexcept {
    const std::uint64_t leftLow = left & 0xFFFFFFFFULL;
    const std::uint64_t leftHigh = left >> 32U;
    const std::uint64_t rightLow = right & 0xFFFFFFFFULL;
    const std::uint64_t rightHigh = right >> 32U;
    const std::uint64_t lowLow = leftLow * rightLow;
    const std::uint64_t lowHigh = leftLow * rightHigh;
    const std::uint64_t highLow = leftHigh * rightLow;
    const std::uint64_t highHigh = leftHigh * rightHigh;
    const std::uint64_t middle = (lowLow >> 32U) + (lowHigh & 0xFFFFFFFFULL) + (highLow & 0xFFFFFFFFULL);
    return {
        highHigh + (lowHigh >> 32U) + (highLow >> 32U) + (middle >> 32U),
        (middle << 32U) | (lowLow & 0xFFFFFFFFULL),
    };
}

UInt128 magnitude(Int128 value) noexcept {
    return value.isNegative() ? wrappingNegate(value.bits()) : value.bits();
}

std::optional<Int128> signedFromMagnitude(UInt128 value, bool negative) noexcept {
    const UInt128 limit = negative ? int128Minimum().bits() : int128Maximum().bits();
    if (value > limit) return std::nullopt;
    return Int128(negative ? wrappingNegate(value) : value);
}

constexpr double kTwoPower64 = 18446744073709551616.0;
constexpr double kTwoPower127 = 170141183460469231731687303715884105728.0;

}

UInt128 wrappingAdd(UInt128 left, UInt128 right) noexcept {
    const std::uint64_t low = left.low() + right.low();
    const std::uint64_t carry = low < left.low() ? 1U : 0U;
    return {left.high() + right.high() + carry, low};
}

UInt128 wrappingSubtract(UInt128 left, UInt128 right) noexcept {
    const std::uint64_t low = left.low() - right.low();
    const std::uint64_t borrow = left.low() < right.low() ? 1U : 0U;
    return {left.high() - right.high() - borrow, low};
}

UInt128 wrappingMultiply(UInt128 left, UInt128 right) noexcept {
    const Product64 lowProduct = multiply64(left.low(), right.low());
    return {lowProduct.high + left.high() * right.low() + left.low() * right.high(), lowProduct.low};
}

UInt128 wrappingNegate(UInt128 value) noexcept {
    return wrappingAdd(UInt128{~value.high(), ~value.low()}, UInt128{1});
}

UInt128 shiftLeft(UInt128 value, unsigned count) noexcept {
    if (count == 0) return value;
    if (count >= 128) return {};
    if (count >= 64) return {value.low() << (count - 64), 0};
    return {(value.high() << count) | (value.low() >> (64 - count)), value.low() << count};
}

UInt128 shiftRight(UInt128 value, unsigned count) noexcept {
    if (count == 0) return value;
    if (count >= 128) return {};
    if (count >= 64) return {0, value.high() >> (count - 64)};
    return {value.high() >> count, (value.low() >> count) | (value.high() << (64 - count))};
}

unsigned bitWidth(UInt128 value) noexcept {
    if (value.high() != 0) return 64U + static_cast<unsigned>(std::bit_width(value.high()));
    return static_cast<unsigned>(std::bit_width(value.low()));
}

UInt128Division divideUnsigned(UInt128 dividend, UInt128 divisor) noexcept {
    if (divisor.isZero()) return {};
    if (dividend < divisor) return {{}, dividend};
    if (dividend.fitsUInt64() && divisor.fitsUInt64()) {
        return {UInt128{dividend.low() / divisor.low()}, UInt128{dividend.low() % divisor.low()}};
    }
    UInt128 quotient;
    UInt128 remainder;
    for (unsigned index = bitWidth(dividend); index-- > 0;) {
        remainder = shiftLeft(remainder, 1);
        if (dividend.bit(index)) remainder = wrappingAdd(remainder, UInt128{1});
        if (remainder >= divisor) {
            remainder = wrappingSubtract(remainder, divisor);
            quotient = wrappingAdd(quotient, shiftLeft(UInt128{1}, index));
        }
    }
    return {quotient, remainder};
}

std::optional<UInt128> checkedAddUnsigned(UInt128 left, UInt128 right) noexcept {
    const UInt128 sum = wrappingAdd(left, right);
    if (sum < left) return std::nullopt;
    return sum;
}

std::optional<UInt128> checkedMultiplyUnsigned(UInt128 left, UInt128 right) noexcept {
    if (left.isZero() || right.isZero()) return UInt128{};
    if (left.high() != 0 && right.high() != 0) return std::nullopt;
    const Product64 lowProduct = multiply64(left.low(), right.low());
    const Product64 crossLeft = multiply64(left.high(), right.low());
    const Product64 crossRight = multiply64(left.low(), right.high());
    if (crossLeft.high != 0 || crossRight.high != 0) return std::nullopt;
    const std::uint64_t cross = crossLeft.low + crossRight.low;
    if (cross < crossLeft.low) return std::nullopt;
    const std::uint64_t high = lowProduct.high + cross;
    if (high < lowProduct.high) return std::nullopt;
    return UInt128{high, lowProduct.low};
}

std::optional<Int128> checkedAdd(Int128 left, Int128 right) noexcept {
    const Int128 sum(wrappingAdd(left.bits(), right.bits()));
    if (left.isNegative() == right.isNegative() && sum.isNegative() != left.isNegative()) return std::nullopt;
    return sum;
}

std::optional<Int128> checkedSubtract(Int128 left, Int128 right) noexcept {
    const Int128 difference(wrappingSubtract(left.bits(), right.bits()));
    if (left.isNegative() != right.isNegative() && difference.isNegative() != left.isNegative()) return std::nullopt;
    return difference;
}

std::optional<Int128> checkedMultiply(Int128 left, Int128 right) noexcept {
    const auto product = checkedMultiplyUnsigned(magnitude(left), magnitude(right));
    if (!product) return std::nullopt;
    return signedFromMagnitude(*product, left.isNegative() != right.isNegative());
}

Int128 truncatingRemainder(Int128 left, Int128 right) noexcept {
    const UInt128Division division = divideUnsigned(magnitude(left), magnitude(right));
    return Int128(left.isNegative() ? wrappingNegate(division.remainder) : division.remainder);
}

std::optional<Int128> checkedDivideEuclid(Int128 left, Int128 right) noexcept {
    if (right.isZero() || (left == int128Minimum() && right == Int128(-1))) return std::nullopt;
    const UInt128Division division = divideUnsigned(magnitude(left), magnitude(right));
    Int128 quotient(left.isNegative() != right.isNegative() ? wrappingNegate(division.quotient) : division.quotient);
    const Int128 remainder(left.isNegative() ? wrappingNegate(division.remainder) : division.remainder);
    if (remainder.isNegative()) {
        quotient = Int128(right.isNegative()
            ? wrappingAdd(quotient.bits(), UInt128{1})
            : wrappingSubtract(quotient.bits(), UInt128{1}));
    }
    return quotient;
}

std::optional<Int128> checkedRemainderEuclid(Int128 left, Int128 right) noexcept {
    if (right.isZero() || (left == int128Minimum() && right == Int128(-1))) return std::nullopt;
    const Int128 remainder = truncatingRemainder(left, right);
    if (!remainder.isNegative()) return remainder;
    return Int128(wrappingAdd(remainder.bits(), magnitude(right)));
}

std::optional<Int128> checkedPower(Int128 base, std::uint32_t exponent) noexcept {
    if (exponent == 0) return Int128(1);
    Int128 accumulator(1);
    Int128 current = base;
    while (exponent > 1) {
        if ((exponent & 1U) != 0) {
            const auto next = checkedMultiply(accumulator, current);
            if (!next) return std::nullopt;
            accumulator = *next;
        }
        exponent /= 2;
        const auto squared = checkedMultiply(current, current);
        if (!squared) return std::nullopt;
        current = *squared;
    }
    return checkedMultiply(accumulator, current);
}

std::optional<Int128> checkedAbsolute(Int128 value) noexcept {
    if (!value.isNegative()) return value;
    return checkedNegate(value);
}

std::optional<Int128> checkedNegate(Int128 value) noexcept {
    if (value == int128Minimum()) return std::nullopt;
    return Int128(wrappingNegate(value.bits()));
}

std::optional<std::int64_t> toInt64(Int128 value) noexcept {
    const std::uint64_t high = value.bits().high();
    const std::uint64_t low = value.bits().low();
    const bool lowNegative = (low >> 63U) != 0;
    if ((high == 0 && !lowNegative) || (high == ~std::uint64_t{0} && lowNegative)) return static_cast<std::int64_t>(low);
    return std::nullopt;
}

std::optional<std::uint64_t> toUInt64(Int128 value) noexcept {
    if (value.bits().high() != 0) return std::nullopt;
    return value.bits().low();
}

std::optional<Int128> toInt128(UInt128 value) noexcept {
    if ((value.high() >> 63U) != 0) return std::nullopt;
    return Int128(value);
}

std::optional<UInt128> toUInt128(Int128 value) noexcept {
    if (value.isNegative()) return std::nullopt;
    return value.bits();
}

double toDouble(UInt128 value) noexcept {
    if (value.fitsUInt64()) return static_cast<double>(value.low());
    const unsigned width = bitWidth(value);
    const unsigned shift = width - 64U;
    std::uint64_t leading = shiftRight(value, shift).low();
    const UInt128 discarded = wrappingSubtract(value, shiftLeft(UInt128{leading}, shift));
    if (!discarded.isZero()) leading |= 1U;
    return std::ldexp(static_cast<double>(leading), static_cast<int>(shift));
}

double toDouble(Int128 value) noexcept {
    const double result = toDouble(magnitude(value));
    return value.isNegative() ? -result : result;
}

Int128 saturatingInt128FromDouble(double value) noexcept {
    if (std::isnan(value)) return Int128{};
    if (value >= kTwoPower127) return int128Maximum();
    if (value <= -kTwoPower127) return int128Minimum();
    const double truncated = std::trunc(std::fabs(value));
    UInt128 bits;
    if (truncated < kTwoPower64) {
        bits = UInt128{static_cast<std::uint64_t>(truncated)};
    }
    else {
        int exponent = 0;
        const double mantissa = std::frexp(truncated, &exponent);
        const auto significand = static_cast<std::uint64_t>(std::ldexp(mantissa, 53));
        bits = shiftLeft(UInt128{significand}, static_cast<unsigned>(exponent - 53));
    }
    return Int128(value < 0 ? wrappingNegate(bits) : bits);
}

std::optional<UInt128> parseUInt128(std::string_view digits, unsigned radix) noexcept {
    if (!digits.empty() && digits.front() == '+') digits.remove_prefix(1);
    if (digits.empty()) return std::nullopt;
    UInt128 value;
    for (char character : digits) {
        unsigned digit = radix;
        if (character >= '0' && character <= '9') digit = static_cast<unsigned>(character - '0');
        else if (character >= 'a' && character <= 'z') digit = static_cast<unsigned>(character - 'a') + 10U;
        else if (character >= 'A' && character <= 'Z') digit = static_cast<unsigned>(character - 'A') + 10U;
        if (digit >= radix) return std::nullopt;
        const auto scaled = checkedMultiplyUnsigned(value, UInt128{radix});
        if (!scaled) return std::nullopt;
        const auto sum = checkedAddUnsigned(*scaled, UInt128{digit});
        if (!sum) return std::nullopt;
        value = *sum;
    }
    return value;
}

std::optional<Int128> parseInt128(std::string_view text) noexcept {
    bool negative = false;
    if (!text.empty() && (text.front() == '-' || text.front() == '+')) {
        negative = text.front() == '-';
        text.remove_prefix(1);
    }
    if (text.empty() || text.front() == '+') return std::nullopt;
    const auto value = parseUInt128(text, 10);
    if (!value) return std::nullopt;
    return signedFromMagnitude(*value, negative);
}

std::string toDecimalString(UInt128 value) {
    if (value.fitsUInt64()) return std::to_string(value.low());
    std::string digits;
    const UInt128 base{10'000'000'000'000'000'000ULL};
    while (!value.fitsUInt64()) {
        const UInt128Division division = divideUnsigned(value, base);
        std::string chunk = std::to_string(division.remainder.low());
        digits.insert(0, std::string(19 - chunk.size(), '0') + chunk);
        value = division.quotient;
    }
    return std::to_string(value.low()) + digits;
}

std::string toDecimalString(Int128 value) {
    std::string text = toDecimalString(magnitude(value));
    if (value.isNegative()) text.insert(text.begin(), '-');
    return text;
}

}
