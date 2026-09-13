#include "numeric/float_text.h"

#include <array>
#include <charconv>
#include <cmath>
#include <cstddef>
#include <string>
#include <string_view>
#include <system_error>

namespace eversoul::native::numeric {
namespace {

struct ShortestDecimal {
    std::string digits;
    int exponent = 0;
};

ShortestDecimal shortestDecimal(double magnitude) {
    std::array<char, 40> buffer{};
    const auto result = std::to_chars(buffer.data(), buffer.data() + buffer.size(), magnitude, std::chars_format::scientific);
    const std::string_view text(buffer.data(), static_cast<std::size_t>(result.ptr - buffer.data()));
    const std::size_t exponentMarker = text.find('e');
    ShortestDecimal decimal;
    for (char character : text.substr(0, exponentMarker)) {
        if (character != '.') decimal.digits.push_back(character);
    }
    std::string_view exponentText = text.substr(exponentMarker + 1);
    bool negativeExponent = false;
    if (exponentText.front() == '+' || exponentText.front() == '-') {
        negativeExponent = exponentText.front() == '-';
        exponentText.remove_prefix(1);
    }
    int scientificExponent = 0;
    std::from_chars(exponentText.data(), exponentText.data() + exponentText.size(), scientificExponent);
    decimal.exponent = (negativeExponent ? -scientificExponent : scientificExponent) + 1;
    return decimal;
}

std::string decimalParts(const ShortestDecimal& decimal, std::size_t fractionDigits) {
    const std::string& digits = decimal.digits;
    const int exponent = decimal.exponent;
    std::string text;
    if (exponent <= 0) {
        const auto minusExponent = static_cast<std::size_t>(-exponent);
        text.append("0.");
        text.append(minusExponent, '0');
        text.append(digits);
        if (fractionDigits > digits.size() && fractionDigits - digits.size() > minusExponent) {
            text.append(fractionDigits - digits.size() - minusExponent, '0');
        }
        return text;
    }
    const auto position = static_cast<std::size_t>(exponent);
    if (position < digits.size()) {
        text.append(digits, 0, position);
        text.push_back('.');
        text.append(digits, position);
        if (fractionDigits > digits.size() - position) text.append(fractionDigits - (digits.size() - position), '0');
        return text;
    }
    text.append(digits);
    text.append(position - digits.size(), '0');
    if (fractionDigits > 0) {
        text.push_back('.');
        text.append(fractionDigits, '0');
    }
    return text;
}

std::string exponentialParts(const ShortestDecimal& decimal) {
    std::string text(1, decimal.digits.front());
    if (decimal.digits.size() > 1) {
        text.push_back('.');
        text.append(decimal.digits, 1);
    }
    const int visibleExponent = decimal.exponent - 1;
    text.push_back('e');
    if (visibleExponent < 0) text.push_back('-');
    text.append(std::to_string(visibleExponent < 0 ? -visibleExponent : visibleExponent));
    return text;
}

}

std::string rustFloatDisplay(double value) {
    if (std::isnan(value)) return "NaN";
    const std::string sign = std::signbit(value) ? "-" : "";
    if (std::isinf(value)) return sign + "inf";
    if (value == 0.0) return sign + "0";
    return sign + decimalParts(shortestDecimal(std::fabs(value)), 0);
}

std::string rustFloatDebug(double value) {
    if (std::isnan(value)) return "NaN";
    const std::string sign = std::signbit(value) ? "-" : "";
    if (std::isinf(value)) return sign + "inf";
    const double magnitude = std::fabs(value);
    if (magnitude == 0.0) return sign + "0.0";
    const ShortestDecimal decimal = shortestDecimal(magnitude);
    if (magnitude < 1e-4 || magnitude >= 1e16) return sign + exponentialParts(decimal);
    return sign + decimalParts(decimal, 1);
}

std::string rustFloatExponential(double magnitude, std::size_t precision) {
    if (magnitude == 0.0) {
        std::string text = precision > 0 ? "0." : "0";
        text.append(precision, '0');
        text.append("e0");
        return text;
    }
    std::string buffer(precision + 64, '\0');
    const auto result = std::to_chars(buffer.data(), buffer.data() + buffer.size(), magnitude, std::chars_format::scientific,
        static_cast<int>(precision));
    const std::string_view text(buffer.data(), static_cast<std::size_t>(result.ptr - buffer.data()));
    const std::size_t marker = text.find('e');
    std::string output(text.substr(0, marker));
    std::string_view exponentText = text.substr(marker + 1);
    bool negative = false;
    if (exponentText.front() == '+' || exponentText.front() == '-') {
        negative = exponentText.front() == '-';
        exponentText.remove_prefix(1);
    }
    int exponent = 0;
    std::from_chars(exponentText.data(), exponentText.data() + exponentText.size(), exponent);
    output.push_back('e');
    if (negative && exponent != 0) output.push_back('-');
    output.append(std::to_string(exponent));
    return output;
}

std::string rustFloatFixed(double magnitude, std::size_t precision) {
    std::string buffer(precision + 400, '\0');
    const auto result = std::to_chars(buffer.data(), buffer.data() + buffer.size(), magnitude, std::chars_format::fixed,
        static_cast<int>(precision));
    return std::string(buffer.data(), static_cast<std::size_t>(result.ptr - buffer.data()));
}

std::string rustIntegerExponential(UInt128 value, std::optional<std::size_t> precision) {
    const UInt128 ten{10};
    const auto remainder10 = [&ten](UInt128 number) { return divideUnsigned(number, ten).remainder.low(); };
    const auto quotient10 = [&ten](UInt128 number) { return divideUnsigned(number, ten).quotient; };
    UInt128 number = value;
    std::size_t exponent = 0;
    while (remainder10(number) == 0 && number >= ten) {
        number = quotient10(number);
        ++exponent;
    }
    std::size_t addedPrecision = 0;
    std::size_t subtractedPrecision = 0;
    if (precision) {
        UInt128 temporary = number;
        std::size_t digits = 0;
        while (temporary >= ten) {
            temporary = quotient10(temporary);
            ++digits;
        }
        addedPrecision = *precision > digits ? *precision - digits : 0;
        subtractedPrecision = digits > *precision ? digits - *precision : 0;
    }
    for (std::size_t index = 1; index < subtractedPrecision; ++index) {
        number = quotient10(number);
        ++exponent;
    }
    if (subtractedPrecision != 0) {
        const std::uint64_t remainder = remainder10(number);
        number = quotient10(number);
        ++exponent;
        if (remainder > 5 || (remainder == 5 && (remainder10(number) % 2 != 0 || subtractedPrecision > 1))) {
            const std::string before = toDecimalString(number);
            number = wrappingAdd(number, UInt128{1});
            if (toDecimalString(number).size() > before.size()) {
                number = quotient10(number);
                ++exponent;
            }
        }
    }
    const std::string digits = toDecimalString(number);
    exponent += digits.size() - 1;
    std::string output(1, digits.front());
    if (digits.size() > 1 || addedPrecision != 0) output.push_back('.');
    output.append(digits, 1);
    output.append(addedPrecision, '0');
    output.push_back('e');
    output.append(std::to_string(exponent));
    return output;
}

std::string uint128InRadix(UInt128 value, unsigned radix, bool uppercase) {
    constexpr std::string_view lowerDigits = "0123456789abcdef";
    constexpr std::string_view upperDigits = "0123456789ABCDEF";
    const std::string_view digits = uppercase ? upperDigits : lowerDigits;
    if (value.isZero()) return "0";
    std::string output;
    const UInt128 base{radix};
    while (!value.isZero()) {
        const UInt128Division division = divideUnsigned(value, base);
        output.push_back(digits[division.remainder.low()]);
        value = division.quotient;
    }
    return std::string(output.rbegin(), output.rend());
}

std::string jsonFloatText(double value) {
    const std::string sign = std::signbit(value) ? "-" : "";
    const double magnitude = std::fabs(value);
    if (magnitude == 0.0) return sign + "0.0";
    const ShortestDecimal decimal = shortestDecimal(magnitude);
    const std::string& digits = decimal.digits;
    const int scientificExponent = decimal.exponent - 1;
    const auto length = static_cast<int>(digits.size());
    std::string text = sign;
    if (scientificExponent >= -5 && scientificExponent <= 15) {
        if (length - 1 <= scientificExponent) {
            text.append(digits);
            text.append(static_cast<std::size_t>(scientificExponent + 1 - length), '0');
            text.append(".0");
        }
        else if (scientificExponent >= 0) {
            text.append(digits, 0, static_cast<std::size_t>(scientificExponent + 1));
            text.push_back('.');
            text.append(digits, static_cast<std::size_t>(scientificExponent + 1));
        }
        else {
            text.append("0.");
            text.append(static_cast<std::size_t>(-scientificExponent - 1), '0');
            text.append(digits);
        }
        return text;
    }
    text.push_back(digits.front());
    if (length > 1) {
        text.push_back('.');
        text.append(digits, 1);
    }
    text.push_back('e');
    text.push_back(scientificExponent >= 0 ? '+' : '-');
    text.append(std::to_string(scientificExponent >= 0 ? scientificExponent : -scientificExponent));
    return text;
}

}
