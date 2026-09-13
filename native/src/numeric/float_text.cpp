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
