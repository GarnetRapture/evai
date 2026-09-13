#include "chat_template/template_operations.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <variant>
#include <vector>

#include "chat_template/template_error.h"
#include "chat_template/template_value.h"
#include "numeric/int128.h"
#include "unicode/utf8_text.h"

namespace eversoul::native::chat_template {
namespace {

using numeric::Int128;
using numeric::UInt128;

constexpr double kTwoPower64 = 18446744073709551616.0;

std::uint64_t saturatingUInt64FromDouble(double value) noexcept {
    if (std::isnan(value) || value <= 0.0) return 0;
    if (value >= kTwoPower64) return UINT64_MAX;
    return static_cast<std::uint64_t>(value);
}

std::int64_t saturatingInt64FromDouble(double value) noexcept {
    if (std::isnan(value)) return 0;
    if (value >= 9223372036854775808.0) return INT64_MAX;
    if (value <= -9223372036854775808.0) return INT64_MIN;
    return static_cast<std::int64_t>(value);
}

UInt128 saturatingUInt128FromDouble(double value) noexcept {
    if (std::isnan(value) || value <= 0.0) return {};
    if (value >= 340282366920938463463374607431768211456.0) return numeric::uint128Maximum();
    const double truncated = std::trunc(value);
    if (truncated < kTwoPower64) return UInt128{static_cast<std::uint64_t>(truncated)};
    int exponent = 0;
    const double mantissa = std::frexp(truncated, &exponent);
    const auto significand = static_cast<std::uint64_t>(std::ldexp(mantissa, 53));
    return numeric::shiftLeft(UInt128{significand}, static_cast<unsigned>(exponent - 53));
}

TemplateError impossibleOperation(std::string_view operation, const Value& left, const Value& right) {
    return TemplateError(TemplateErrorKind::InvalidOperation,
        "tried to use " + std::string(operation) + " operator on unsupported types " + std::string(valueKindName(left.kind()))
            + " and " + std::string(valueKindName(right.kind())));
}

TemplateError failedOperation(std::string_view operation, const Value& left, const Value& right) {
    return TemplateError(TemplateErrorKind::InvalidOperation,
        "unable to calculate " + left.toString() + " " + std::string(operation) + " " + right.toString());
}

std::pair<std::size_t, std::size_t> offsetAndLength(std::optional<std::int64_t> start, std::optional<std::int64_t> stop,
    const std::function<std::size_t()>& end) {
    const std::int64_t startValue = start.value_or(0);
    if (startValue < 0 || !stop || *stop < 0) {
        const std::size_t total = end();
        const std::size_t first = startValue < 0
            ? static_cast<std::size_t>(std::max<std::int64_t>(0, static_cast<std::int64_t>(total) + startValue))
            : static_cast<std::size_t>(startValue);
        std::size_t last = total;
        if (stop) {
            last = *stop < 0 ? static_cast<std::size_t>(std::max<std::int64_t>(0, static_cast<std::int64_t>(total) + *stop))
                             : static_cast<std::size_t>(*stop);
        }
        return {first, last > first ? last - first : 0};
    }
    const auto first = static_cast<std::size_t>(startValue);
    const auto last = static_cast<std::size_t>(*stop);
    return {first, last > first ? last - first : 0};
}

std::vector<std::size_t> backwardIndices(std::optional<std::int64_t> start, std::optional<std::int64_t> stop, std::size_t step, std::size_t end) {
    std::size_t first = 0;
    if (!start || *start >= static_cast<std::int64_t>(end)) first = end > 0 ? end - 1 : 0;
    else if (*start >= 0) first = static_cast<std::size_t>(*start);
    else first = static_cast<std::size_t>(std::max<std::int64_t>(static_cast<std::int64_t>(end) + *start, 0));
    std::size_t last = 0;
    if (stop) {
        last = *stop < 0 ? static_cast<std::size_t>(std::max<std::int64_t>(static_cast<std::int64_t>(end) + *stop, 0))
                         : static_cast<std::size_t>(*stop);
    }
    const std::size_t length = last == 0 ? (first + step) / step : (first - last + step - 1) / step;
    std::vector<std::size_t> indices;
    if (last > first) return indices;
    for (std::size_t index = first, produced = 0; produced < length; ++produced) {
        indices.push_back(index);
        if (index < last + step) break;
        index -= step;
    }
    return indices;
}

std::optional<std::int64_t> sliceBound(const Value& value) {
    if (value.isNone()) return std::nullopt;
    const auto integer = value.tryInt64();
    if (!integer) {
        throw TemplateError(TemplateErrorKind::InvalidOperation, "cannot convert " + std::string(valueKindName(value.kind())) + " to i64");
    }
    return integer;
}

Value repeatIterable(const Value& count, const std::shared_ptr<TemplateObject>& sequence) {
    const auto repetitions = count.asUsize();
    if (!repetitions) {
        throw TemplateError(TemplateErrorKind::InvalidOperation, "sequences and iterables can only be multiplied with integers");
    }
    const auto length = sequence->enumeratorLength();
    if (!length) throw TemplateError(TemplateErrorKind::InvalidOperation, "cannot repeat unsized iterables");
    const std::size_t times = *repetitions;
    const std::size_t itemCount = *length;
    std::shared_ptr<const TemplateObject> source = sequence;
    return makeIterable([source, times, itemCount]() -> ValueIteratorPointer {
        auto round = std::make_shared<std::size_t>(0);
        auto current = std::make_shared<ValueIteratorPointer>();
        auto generator = makeGeneratorIterator([source, times, itemCount, round, current]() -> std::optional<Value> {
            for (;;) {
                if (*current) {
                    if (auto value = (*current)->next()) return value;
                    current->reset();
                }
                if (*round >= times) return std::nullopt;
                ++*round;
                *current = source->tryIterate();
                if (!*current) {
                    std::vector<Value> failures(itemCount,
                        Value::fromInvalid(TemplateError(TemplateErrorKind::InvalidOperation, "iterable did not iterate against expectations")));
                    *current = makeVectorIterator(std::move(failures));
                }
            }
        });
        return makeLengthWrappedIterator(itemCount * times, std::move(generator));
    });
}

}

std::optional<double> valueAsFloat(const Value& value, bool lossy) noexcept {
    const auto& representation = value.representation();
    if (const auto* flag = std::get_if<bool>(&representation)) return *flag ? 1.0 : 0.0;
    if (const auto* unsignedValue = std::get_if<std::uint64_t>(&representation)) {
        const auto result = static_cast<double>(*unsignedValue);
        if (lossy || saturatingUInt64FromDouble(result) == *unsignedValue) return result;
        return std::nullopt;
    }
    if (const auto* wide = std::get_if<UInt128>(&representation)) {
        const double result = numeric::toDouble(*wide);
        if (lossy || saturatingUInt128FromDouble(result) == *wide) return result;
        return std::nullopt;
    }
    if (const auto* signedValue = std::get_if<std::int64_t>(&representation)) {
        const auto result = static_cast<double>(*signedValue);
        if (lossy || saturatingInt64FromDouble(result) == *signedValue) return result;
        return std::nullopt;
    }
    if (const auto* wideSigned = std::get_if<Int128>(&representation)) {
        const double result = numeric::toDouble(*wideSigned);
        if (lossy || numeric::saturatingInt128FromDouble(result) == *wideSigned) return result;
        return std::nullopt;
    }
    if (const auto* floating = std::get_if<double>(&representation)) return *floating;
    return std::nullopt;
}

std::optional<CoerceResult> coerceValues(const Value& left, const Value& right, bool lossy) noexcept {
    const auto& a = left.representation();
    const auto& b = right.representation();
    if (std::holds_alternative<std::uint64_t>(a) && std::holds_alternative<std::uint64_t>(b)) {
        return CoercedIntegers{Int128(UInt128{std::get<std::uint64_t>(a)}), Int128(UInt128{std::get<std::uint64_t>(b)})};
    }
    if (std::holds_alternative<UInt128>(a) && std::holds_alternative<UInt128>(b)) {
        return CoercedIntegers{Int128(std::get<UInt128>(a)), Int128(std::get<UInt128>(b))};
    }
    const auto* leftText = std::get_if<Value::StringRepresentation>(&a);
    const auto* rightText = std::get_if<Value::StringRepresentation>(&b);
    if (leftText != nullptr && rightText != nullptr) return CoercedStrings{*leftText->text, *rightText->text};
    if (std::holds_alternative<std::int64_t>(a) && std::holds_alternative<std::int64_t>(b)) {
        return CoercedIntegers{Int128(std::get<std::int64_t>(a)), Int128(std::get<std::int64_t>(b))};
    }
    if (std::holds_alternative<Int128>(a) && std::holds_alternative<Int128>(b)) {
        return CoercedIntegers{std::get<Int128>(a), std::get<Int128>(b)};
    }
    if (std::holds_alternative<double>(a) && std::holds_alternative<double>(b)) {
        return CoercedFloats{std::get<double>(a), std::get<double>(b)};
    }
    if (const auto* floating = std::get_if<double>(&a)) {
        const auto other = valueAsFloat(right, lossy);
        if (!other) return std::nullopt;
        return CoercedFloats{*floating, *other};
    }
    if (const auto* floating = std::get_if<double>(&b)) {
        const auto other = valueAsFloat(left, lossy);
        if (!other) return std::nullopt;
        return CoercedFloats{*other, *floating};
    }
    const auto leftInteger = left.tryInt128();
    if (!leftInteger) return std::nullopt;
    const auto rightInteger = right.tryInt128();
    if (!rightInteger) return std::nullopt;
    return CoercedIntegers{*leftInteger, *rightInteger};
}

Value integerAsValue(Int128 value) {
    if (const auto narrow = numeric::toInt64(value)) return Value::fromInt64(*narrow);
    return Value::fromInt128(value);
}

Value sliceValue(const Value& value, const Value& start, const Value& stop, const Value& step) {
    const auto startIndex = sliceBound(start);
    const auto stopIndex = sliceBound(stop);
    std::int64_t stepSize = 1;
    if (!step.isNone()) {
        const auto integer = step.tryInt64();
        if (!integer) throw TemplateError(TemplateErrorKind::InvalidOperation, "cannot convert " + std::string(valueKindName(step.kind())) + " to i64");
        stepSize = *integer;
    }
    if (stepSize == 0) throw TemplateError(TemplateErrorKind::InvalidOperation, "cannot slice by step size of 0");

    if (const auto* text = std::get_if<Value::StringRepresentation>(&value.representation())) {
        const std::u32string characters = unicode::decodeUtf8(*text->text);
        std::u32string result;
        if (stepSize > 0) {
            const auto [offset, length] = offsetAndLength(startIndex, stopIndex, [&characters] { return characters.size(); });
            for (std::size_t index = offset, taken = 0; index < characters.size() && taken < length; ++index, ++taken) {
                if (taken % static_cast<std::size_t>(stepSize) == 0) result.push_back(characters[index]);
            }
        }
        else {
            for (std::size_t index : backwardIndices(startIndex, stopIndex, static_cast<std::size_t>(-stepSize), characters.size())) {
                if (index >= characters.size()) throw TemplateError(TemplateErrorKind::InvalidOperation, "index out of bounds");
                result.push_back(characters[index]);
            }
        }
        return Value::fromString(unicode::encodeUtf8(result));
    }
    if (const auto* bytes = std::get_if<Value::BytesRepresentation>(&value.representation())) {
        const std::vector<std::uint8_t>& data = *bytes->bytes;
        std::vector<std::uint8_t> result;
        if (stepSize > 0) {
            const auto [offset, length] = offsetAndLength(startIndex, stopIndex, [&data] { return data.size(); });
            for (std::size_t index = offset, taken = 0; index < data.size() && taken < length; ++index, ++taken) {
                if (taken % static_cast<std::size_t>(stepSize) == 0) result.push_back(data[index]);
            }
        }
        else {
            for (std::size_t index : backwardIndices(startIndex, stopIndex, static_cast<std::size_t>(-stepSize), data.size())) {
                if (index >= data.size()) throw TemplateError(TemplateErrorKind::InvalidOperation, "index out of bounds");
                result.push_back(data[index]);
            }
        }
        return Value::fromBytes(std::move(result));
    }
    if (value.isUndefined() || value.isNone()) return Value::fromSequence({});
    if (const auto* object = value.asObject()) {
        const ObjectRepresentation representation = (*object)->representation();
        if (representation == ObjectRepresentation::Seq || representation == ObjectRepresentation::Iterable) {
            std::shared_ptr<const TemplateObject> source = *object;
            if (stepSize > 0) {
                const std::size_t total = source->enumeratorLength().value_or(0);
                const auto [offset, length] = offsetAndLength(startIndex, stopIndex, [total] { return total; });
                const auto stride = static_cast<std::size_t>(stepSize);
                const std::size_t skip = offset;
                const std::size_t take = length;
                return makeIterable([source, skip, take, stride]() -> ValueIteratorPointer {
                    auto iterator = source->tryIterate();
                    if (!iterator) return makeEmptyIterator();
                    return makeSkipTakeStepIterator(std::move(iterator), skip, take, stride);
                });
            }
            const auto stride = static_cast<std::size_t>(-stepSize);
            return makeIterable([source, startIndex, stopIndex, stride]() -> ValueIteratorPointer {
                auto iterator = source->tryIterate();
                if (!iterator) return makeEmptyIterator();
                std::vector<Value> values = collectValues(*iterator);
                std::vector<Value> selected;
                for (std::size_t index : backwardIndices(startIndex, stopIndex, stride, values.size())) {
                    if (index >= values.size()) throw TemplateError(TemplateErrorKind::InvalidOperation, "index out of bounds");
                    selected.push_back(values[index]);
                }
                return makeLengthWrappedIterator(selected.size(), makeVectorIterator(std::move(selected)));
            });
        }
    }
    throw TemplateError(TemplateErrorKind::InvalidOperation, "value of type " + std::string(valueKindName(value.kind())) + " cannot be sliced");
}

Value addValues(const Value& left, const Value& right) {
    const auto sequenceLike = [](ValueKind kind) { return kind == ValueKind::Seq || kind == ValueKind::Iterable; };
    if (sequenceLike(left.kind()) && sequenceLike(right.kind())) {
        Value first = left;
        Value second = right;
        return makeIterable([first, second]() -> ValueIteratorPointer {
            try {
                auto leftIterator = first.tryIterate();
                auto rightIterator = second.tryIterate();
                return makeChainIterator(std::move(leftIterator), std::move(rightIterator));
            }
            catch (const TemplateError&) {
                return makeEmptyIterator();
            }
        });
    }
    const auto coerced = coerceValues(left, right, true);
    if (coerced) {
        if (const auto* integers = std::get_if<CoercedIntegers>(&*coerced)) {
            const auto sum = numeric::checkedAdd(integers->left, integers->right);
            if (!sum) throw failedOperation("+", left, right);
            return integerAsValue(*sum);
        }
        if (const auto* floats = std::get_if<CoercedFloats>(&*coerced)) return Value::fromDouble(floats->left + floats->right);
        const auto& strings = std::get<CoercedStrings>(*coerced);
        return Value::fromString(std::string(strings.left) + std::string(strings.right));
    }
    throw impossibleOperation("+", left, right);
}

Value subtractValues(const Value& left, const Value& right) {
    const auto coerced = coerceValues(left, right, true);
    if (coerced) {
        if (const auto* integers = std::get_if<CoercedIntegers>(&*coerced)) {
            const auto difference = numeric::checkedSubtract(integers->left, integers->right);
            if (!difference) throw failedOperation("-", left, right);
            return integerAsValue(*difference);
        }
        if (const auto* floats = std::get_if<CoercedFloats>(&*coerced)) return Value::fromDouble(floats->left - floats->right);
    }
    throw impossibleOperation("-", left, right);
}

Value remainderValues(const Value& left, const Value& right) {
    const auto coerced = coerceValues(left, right, true);
    if (coerced) {
        if (const auto* integers = std::get_if<CoercedIntegers>(&*coerced)) {
            const auto remainder = numeric::checkedRemainderEuclid(integers->left, integers->right);
            if (!remainder) throw failedOperation("%", left, right);
            return integerAsValue(*remainder);
        }
        if (const auto* floats = std::get_if<CoercedFloats>(&*coerced)) return Value::fromDouble(std::fmod(floats->left, floats->right));
    }
    throw impossibleOperation("%", left, right);
}

Value multiplyValues(const Value& left, const Value& right) {
    std::optional<std::pair<std::string_view, const Value*>> repeated;
    if (const auto text = left.asString()) repeated = std::pair{*text, &right};
    else if (const auto other = right.asString()) repeated = std::pair{*other, &left};
    if (repeated) {
        const auto count = repeated->second->asUsize();
        if (!count) throw TemplateError(TemplateErrorKind::InvalidOperation, "strings can only be multiplied with integers");
        std::string result;
        result.reserve(repeated->first.size() * *count);
        for (std::size_t index = 0; index < *count; ++index) result.append(repeated->first);
        return Value::fromString(result);
    }
    std::optional<std::pair<std::shared_ptr<TemplateObject>, const Value*>> sequence;
    if (const auto* object = left.asObject()) sequence = std::pair{*object, &right};
    else if (const auto* other = right.asObject()) sequence = std::pair{*other, &left};
    if (sequence) {
        const ObjectRepresentation representation = sequence->first->representation();
        if (representation == ObjectRepresentation::Iterable || representation == ObjectRepresentation::Seq) {
            return repeatIterable(*sequence->second, sequence->first);
        }
    }
    const auto coerced = coerceValues(left, right, true);
    if (coerced) {
        if (const auto* integers = std::get_if<CoercedIntegers>(&*coerced)) {
            const auto product = numeric::checkedMultiply(integers->left, integers->right);
            if (!product) throw failedOperation("*", left, right);
            return integerAsValue(*product);
        }
        if (const auto* floats = std::get_if<CoercedFloats>(&*coerced)) return Value::fromDouble(floats->left * floats->right);
    }
    throw impossibleOperation("*", left, right);
}

Value divideValues(const Value& left, const Value& right) {
    const auto dividend = valueAsFloat(left, true);
    const auto divisor = valueAsFloat(right, true);
    if (!dividend || !divisor) throw impossibleOperation("/", left, right);
    return Value::fromDouble(*dividend / *divisor);
}

Value integerDivideValues(const Value& left, const Value& right) {
    const auto coerced = coerceValues(left, right, true);
    if (coerced) {
        if (const auto* integers = std::get_if<CoercedIntegers>(&*coerced)) {
            if (integers->right.isZero()) throw failedOperation("//", left, right);
            const auto quotient = numeric::checkedDivideEuclid(integers->left, integers->right);
            if (!quotient) throw failedOperation("//", left, right);
            return integerAsValue(*quotient);
        }
        if (const auto* floats = std::get_if<CoercedFloats>(&*coerced)) {
            double quotient = std::trunc(floats->left / floats->right);
            if (std::fmod(floats->left, floats->right) < 0.0) quotient = floats->right > 0.0 ? quotient - 1.0 : quotient + 1.0;
            return Value::fromDouble(quotient);
        }
    }
    throw impossibleOperation("//", left, right);
}

Value powerValues(const Value& left, const Value& right) {
    const auto coerced = coerceValues(left, right, true);
    if (coerced) {
        if (const auto* integers = std::get_if<CoercedIntegers>(&*coerced)) {
            const auto exponent = numeric::toUInt64(integers->right);
            if (exponent && *exponent <= UINT32_MAX) {
                if (const auto result = numeric::checkedPower(integers->left, static_cast<std::uint32_t>(*exponent))) {
                    return integerAsValue(*result);
                }
            }
            throw failedOperation("**", left, right);
        }
        if (const auto* floats = std::get_if<CoercedFloats>(&*coerced)) return Value::fromDouble(std::pow(floats->left, floats->right));
    }
    throw impossibleOperation("**", left, right);
}

Value negateValue(const Value& value) {
    if (value.kind() != ValueKind::Number) throw TemplateError(TemplateErrorKind::InvalidOperation);
    if (const auto* floating = std::get_if<double>(&value.representation())) return Value::fromDouble(-*floating);
    if (const auto* wide = std::get_if<UInt128>(&value.representation())) {
        if (*wide == numeric::int128Minimum().bits()) return value;
    }
    const auto integer = value.tryInt128();
    if (!integer) throw TemplateError(TemplateErrorKind::InvalidOperation);
    const auto negated = numeric::checkedMultiply(*integer, Int128(-1));
    if (!negated) throw TemplateError(TemplateErrorKind::InvalidOperation, "overflow");
    return integerAsValue(*negated);
}

Value concatenateValues(const Value& left, const Value& right) {
    return Value::fromString(left.toString() + right.toString());
}

Value containsValue(const Value& container, const Value& value) {
    if (container.isUndefined()) return Value::fromBool(false);
    if (const auto text = container.asString()) {
        if (const auto needle = value.asString()) return Value::fromBool(text->find(*needle) != std::string_view::npos);
        return Value::fromBool(text->find(value.toString()) != std::string_view::npos);
    }
    if (const auto* object = container.asObject()) {
        switch ((*object)->representation()) {
        case ObjectRepresentation::Plain: return Value::fromBool(false);
        case ObjectRepresentation::Map: return Value::fromBool((*object)->getValue(value).has_value());
        case ObjectRepresentation::Seq:
        case ObjectRepresentation::Iterable: {
            if (auto iterator = (*object)->tryIterate()) {
                while (auto item = iterator->next()) {
                    if (*item == value) return Value::fromBool(true);
                }
            }
            return Value::fromBool(false);
        }
        }
    }
    throw TemplateError(TemplateErrorKind::InvalidOperation, "cannot perform a containment check on this value");
}

}
