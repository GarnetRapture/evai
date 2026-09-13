#pragma once

#include <optional>
#include <string_view>
#include <variant>

#include "chat_template/template_value.h"
#include "numeric/int128.h"

namespace eversoul::native::chat_template {

struct CoercedIntegers {
    numeric::Int128 left;
    numeric::Int128 right;
};

struct CoercedFloats {
    double left;
    double right;
};

struct CoercedStrings {
    std::string_view left;
    std::string_view right;
};

using CoerceResult = std::variant<CoercedIntegers, CoercedFloats, CoercedStrings>;

[[nodiscard]] std::optional<double> valueAsFloat(const Value& value, bool lossy) noexcept;
[[nodiscard]] std::optional<CoerceResult> coerceValues(const Value& left, const Value& right, bool lossy) noexcept;

[[nodiscard]] Value sliceValue(const Value& value, const Value& start, const Value& stop, const Value& step);
[[nodiscard]] Value addValues(const Value& left, const Value& right);
[[nodiscard]] Value subtractValues(const Value& left, const Value& right);
[[nodiscard]] Value multiplyValues(const Value& left, const Value& right);
[[nodiscard]] Value divideValues(const Value& left, const Value& right);
[[nodiscard]] Value integerDivideValues(const Value& left, const Value& right);
[[nodiscard]] Value remainderValues(const Value& left, const Value& right);
[[nodiscard]] Value powerValues(const Value& left, const Value& right);
[[nodiscard]] Value negateValue(const Value& value);
[[nodiscard]] Value concatenateValues(const Value& left, const Value& right);
[[nodiscard]] Value containsValue(const Value& container, const Value& value);
[[nodiscard]] Value integerAsValue(numeric::Int128 value);

}
