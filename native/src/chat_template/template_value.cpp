#include "chat_template/template_value.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <compare>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <memory>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <typeinfo>
#include <utility>
#include <variant>
#include <vector>

#include "chat_template/template_error.h"
#include "chat_template/template_operations.h"
#include "numeric/float_text.h"
#include "numeric/int128.h"
#include "text_format/debug_writer.h"
#include "unicode/utf8_text.h"

namespace eversoul::native::chat_template {
namespace {

using numeric::Int128;
using numeric::UInt128;

class VectorIterator final : public ValueIterator {
public:
    explicit VectorIterator(std::vector<Value> values) noexcept : values_(std::move(values)) {}
    std::optional<Value> next() override {
        if (position_ >= values_.size()) return std::nullopt;
        return values_[position_++];
    }
    SizeHint sizeHint() const override {
        const std::size_t remaining = values_.size() - position_;
        return {remaining, remaining};
    }

private:
    std::vector<Value> values_;
    std::size_t position_ = 0;
};

class EmptyIterator final : public ValueIterator {
public:
    std::optional<Value> next() override { return std::nullopt; }
    SizeHint sizeHint() const override { return {0, std::size_t{0}}; }
};

class LengthWrappedIterator final : public ValueIterator {
public:
    LengthWrappedIterator(std::size_t length, ValueIteratorPointer inner) noexcept : length_(length), inner_(std::move(inner)) {}
    std::optional<Value> next() override { return inner_->next(); }
    SizeHint sizeHint() const override { return {length_, length_}; }

private:
    std::size_t length_;
    ValueIteratorPointer inner_;
};

class SkipTakeStepIterator final : public ValueIterator {
public:
    SkipTakeStepIterator(ValueIteratorPointer inner, std::size_t skip, std::size_t take, std::size_t step) noexcept
        : inner_(std::move(inner)), skip_(skip), take_(take), step_(step) {}

    std::optional<Value> next() override {
        const std::size_t advance = firstTake_ ? 0 : step_ - 1;
        firstTake_ = false;
        for (std::size_t index = 0; index < advance; ++index) {
            if (!takeNext()) return std::nullopt;
        }
        return takeNext();
    }

    SizeHint sizeHint() const override {
        SizeHint inner = inner_->sizeHint();
        SizeHint skipped{inner.lower > skip_ ? inner.lower - skip_ : 0,
            inner.upper ? std::optional<std::size_t>(*inner.upper > skip_ ? *inner.upper - skip_ : 0) : std::nullopt};
        SizeHint taken;
        if (take_ == 0) {
            taken = {0, std::size_t{0}};
        }
        else {
            taken.lower = std::min(skipped.lower, take_);
            taken.upper = skipped.upper && *skipped.upper < take_ ? *skipped.upper : take_;
        }
        const auto transform = [this](std::size_t count) -> std::size_t {
            if (firstTake_) return count == 0 ? 0 : 1 + (count - 1) / step_;
            return count / step_;
        };
        return {transform(taken.lower), taken.upper ? std::optional<std::size_t>(transform(*taken.upper)) : std::nullopt};
    }

private:
    std::optional<Value> takeNext() {
        if (take_ == 0) return std::nullopt;
        while (skip_ > 0) {
            --skip_;
            if (!inner_->next()) {
                skip_ = 0;
                take_ = 0;
                return std::nullopt;
            }
        }
        --take_;
        return inner_->next();
    }

    ValueIteratorPointer inner_;
    std::size_t skip_;
    std::size_t take_;
    std::size_t step_;
    bool firstTake_ = true;
};

class ChainIterator final : public ValueIterator {
public:
    ChainIterator(ValueIteratorPointer first, ValueIteratorPointer second) noexcept
        : first_(std::move(first)), second_(std::move(second)) {}

    std::optional<Value> next() override {
        if (first_) {
            if (auto value = first_->next()) return value;
            first_.reset();
        }
        if (second_) return second_->next();
        return std::nullopt;
    }

    SizeHint sizeHint() const override {
        if (first_ && second_) {
            const SizeHint left = first_->sizeHint();
            const SizeHint right = second_->sizeHint();
            SizeHint combined;
            combined.lower = left.lower > SIZE_MAX - right.lower ? SIZE_MAX : left.lower + right.lower;
            if (left.upper && right.upper && *left.upper <= SIZE_MAX - *right.upper) combined.upper = *left.upper + *right.upper;
            return combined;
        }
        if (first_) return first_->sizeHint();
        if (second_) return second_->sizeHint();
        return {0, std::size_t{0}};
    }

private:
    ValueIteratorPointer first_;
    ValueIteratorPointer second_;
};

class GeneratorIterator final : public ValueIterator {
public:
    explicit GeneratorIterator(std::function<std::optional<Value>()> generator) noexcept : generator_(std::move(generator)) {}
    std::optional<Value> next() override { return generator_(); }
    SizeHint sizeHint() const override { return {0, std::nullopt}; }

private:
    std::function<std::optional<Value>()> generator_;
};

class CharacterIterator final : public ValueIterator {
public:
    explicit CharacterIterator(std::shared_ptr<const std::string> text) noexcept
        : text_(std::move(text)), remaining_(unicode::codePointCount(*text_)) {}

    std::optional<Value> next() override {
        if (offset_ >= text_->size()) return std::nullopt;
        const unicode::Utf8CodePoint decoded = unicode::decodeCodePointAt(*text_, offset_);
        offset_ += decoded.byteLength;
        --remaining_;
        return Value::fromCodePoint(decoded.codePoint);
    }

    SizeHint sizeHint() const override { return {0, remaining_}; }

private:
    std::shared_ptr<const std::string> text_;
    std::size_t offset_ = 0;
    std::size_t remaining_;
};

class SequenceIndexIterator final : public ValueIterator {
public:
    SequenceIndexIterator(std::shared_ptr<const TemplateObject> object, std::size_t length) noexcept
        : object_(std::move(object)), length_(length) {}

    std::optional<Value> next() override {
        if (index_ >= length_) return std::nullopt;
        return object_->getValue(Value::fromUInt64(index_++)).value_or(Value::undefined());
    }

    SizeHint sizeHint() const override {
        const std::size_t remaining = length_ - index_;
        return {remaining, remaining};
    }

private:
    std::shared_ptr<const TemplateObject> object_;
    std::size_t length_;
    std::size_t index_ = 0;
};

class ReverseSequenceIndexIterator final : public ValueIterator {
public:
    ReverseSequenceIndexIterator(std::shared_ptr<const TemplateObject> object, std::size_t length) noexcept
        : object_(std::move(object)), remaining_(length) {}

    std::optional<Value> next() override {
        if (remaining_ == 0) return std::nullopt;
        --remaining_;
        return object_->getValue(Value::fromUInt64(remaining_)).value_or(Value::undefined());
    }

    SizeHint sizeHint() const override { return {remaining_, remaining_}; }

private:
    std::shared_ptr<const TemplateObject> object_;
    std::size_t remaining_;
};

class StringListIterator final : public ValueIterator {
public:
    explicit StringListIterator(std::vector<std::string_view> values) noexcept : values_(std::move(values)) {}
    std::optional<Value> next() override {
        if (position_ >= values_.size()) return std::nullopt;
        return Value::fromString(values_[position_++]);
    }
    SizeHint sizeHint() const override {
        const std::size_t remaining = values_.size() - position_;
        return {remaining, remaining};
    }

private:
    std::vector<std::string_view> values_;
    std::size_t position_ = 0;
};

class ObjectHoldingIterator final : public ValueIterator {
public:
    ObjectHoldingIterator(std::shared_ptr<const TemplateObject> object, ValueIteratorPointer inner) noexcept
        : object_(std::move(object)), inner_(std::move(inner)) {}
    std::optional<Value> next() override { return inner_->next(); }
    SizeHint sizeHint() const override { return inner_->sizeHint(); }

private:
    std::shared_ptr<const TemplateObject> object_;
    ValueIteratorPointer inner_;
};

std::string lossyUtf8(std::span<const std::uint8_t> bytes) {
    std::string output;
    std::size_t index = 0;
    const auto continuation = [&](std::size_t position) {
        return position < bytes.size() && (bytes[position] & 0xC0U) == 0x80U;
    };
    while (index < bytes.size()) {
        const std::uint8_t lead = bytes[index];
        if (lead < 0x80U) {
            output.push_back(static_cast<char>(lead));
            ++index;
            continue;
        }
        std::size_t width = 0;
        if (lead >= 0xC2U && lead <= 0xDFU) width = 2;
        else if (lead >= 0xE0U && lead <= 0xEFU) width = 3;
        else if (lead >= 0xF0U && lead <= 0xF4U) width = 4;
        if (width == 0) {
            output.append("\xEF\xBF\xBD");
            ++index;
            continue;
        }
        std::size_t valid = 1;
        if (index + 1 < bytes.size()) {
            const std::uint8_t second = bytes[index + 1];
            bool secondValid = (second & 0xC0U) == 0x80U;
            if (lead == 0xE0U) secondValid = second >= 0xA0U && second <= 0xBFU;
            else if (lead == 0xEDU) secondValid = second >= 0x80U && second <= 0x9FU;
            else if (lead == 0xF0U) secondValid = second >= 0x90U && second <= 0xBFU;
            else if (lead == 0xF4U) secondValid = second >= 0x80U && second <= 0x8FU;
            if (secondValid) {
                valid = 2;
                while (valid < width && continuation(index + valid)) ++valid;
            }
        }
        if (valid == width) {
            output.append(reinterpret_cast<const char*>(bytes.data() + index), width);
        }
        else {
            output.append("\xEF\xBF\xBD");
        }
        index += valid;
    }
    return output;
}

void writeByteDebug(text_format::DebugWriter& writer, std::span<const std::uint8_t> bytes) {
    constexpr std::string_view hex = "0123456789abcdef";
    std::string text = "b'";
    for (std::uint8_t byte : bytes) {
        switch (byte) {
        case '"': text.push_back('"'); break;
        case '\t': text.append("\\t"); break;
        case '\r': text.append("\\r"); break;
        case '\n': text.append("\\n"); break;
        case '\'': text.append("\\'"); break;
        case '\\': text.append("\\\\"); break;
        default:
            if (byte >= 0x20U && byte <= 0x7EU) {
                text.push_back(static_cast<char>(byte));
            }
            else {
                text.append("\\x");
                text.push_back(hex[byte >> 4U]);
                text.push_back(hex[byte & 0xFU]);
            }
            break;
        }
    }
    text.push_back('\'');
    writer.write(text);
}

std::strong_ordering totalFloatOrder(double left, double right) noexcept {
    std::int64_t leftBits = 0;
    std::int64_t rightBits = 0;
    std::memcpy(&leftBits, &left, sizeof(left));
    std::memcpy(&rightBits, &right, sizeof(right));
    leftBits ^= static_cast<std::int64_t>(static_cast<std::uint64_t>(leftBits >> 63) >> 1U);
    rightBits ^= static_cast<std::int64_t>(static_cast<std::uint64_t>(rightBits >> 63) >> 1U);
    return leftBits <=> rightBits;
}

void appendHashBytes(std::string& stream, std::uint64_t value) {
    for (unsigned shift = 0; shift < 64; shift += 8) stream.push_back(static_cast<char>((value >> shift) & 0xFFU));
}

std::optional<std::size_t> indexFromKey(const Value& key, const std::function<std::optional<std::size_t>()>& length) {
    const auto signedIndex = key.tryInt64();
    if (!signedIndex) return std::nullopt;
    if (*signedIndex < 0) {
        const auto total = length();
        if (!total) return std::nullopt;
        const auto magnitude = static_cast<std::size_t>(-(*signedIndex + 1)) + 1;
        if (magnitude > *total) return std::nullopt;
        return *total - magnitude;
    }
    return static_cast<std::size_t>(*signedIndex);
}

}

std::string_view valueKindName(ValueKind kind) noexcept {
    switch (kind) {
    case ValueKind::Undefined: return "undefined";
    case ValueKind::None: return "none";
    case ValueKind::Bool: return "bool";
    case ValueKind::Number: return "number";
    case ValueKind::String: return "string";
    case ValueKind::Bytes: return "bytes";
    case ValueKind::Seq: return "sequence";
    case ValueKind::Map: return "map";
    case ValueKind::Iterable: return "iterator";
    case ValueKind::Plain: return "plain object";
    case ValueKind::Invalid: return "invalid value";
    }
    return "invalid value";
}

std::optional<std::size_t> exactLength(const SizeHint& hint) noexcept {
    if (hint.upper && *hint.upper == hint.lower) return hint.lower;
    return std::nullopt;
}

ObjectEnumerator::ObjectEnumerator() = default;
ObjectEnumerator::ObjectEnumerator(ObjectEnumerator&&) noexcept = default;
ObjectEnumerator& ObjectEnumerator::operator=(ObjectEnumerator&&) noexcept = default;
ObjectEnumerator::~ObjectEnumerator() = default;

ObjectEnumerator ObjectEnumerator::nonEnumerable() {
    ObjectEnumerator enumerator;
    enumerator.kind_ = Kind::NonEnumerable;
    return enumerator;
}

ObjectEnumerator ObjectEnumerator::empty() {
    return ObjectEnumerator();
}

ObjectEnumerator ObjectEnumerator::strings(std::vector<std::string_view> values) {
    ObjectEnumerator enumerator;
    enumerator.kind_ = Kind::Strings;
    enumerator.strings_ = std::move(values);
    return enumerator;
}

ObjectEnumerator ObjectEnumerator::iterator(ValueIteratorPointer iterator) {
    ObjectEnumerator enumerator;
    enumerator.kind_ = Kind::Iterator;
    enumerator.iterator_ = std::move(iterator);
    return enumerator;
}

ObjectEnumerator ObjectEnumerator::reversibleIterator(ValueIteratorPointer iterator) {
    ObjectEnumerator enumerator;
    enumerator.kind_ = Kind::ReversibleIterator;
    enumerator.iterator_ = std::move(iterator);
    return enumerator;
}

ObjectEnumerator ObjectEnumerator::sequence(std::size_t length) {
    ObjectEnumerator enumerator;
    enumerator.kind_ = Kind::Sequence;
    enumerator.length_ = length;
    return enumerator;
}

ObjectEnumerator ObjectEnumerator::values(std::vector<Value> values) {
    ObjectEnumerator enumerator;
    enumerator.kind_ = Kind::Values;
    enumerator.values_ = std::move(values);
    return enumerator;
}

std::optional<std::size_t> ObjectEnumerator::queryLength() const {
    switch (kind_) {
    case Kind::Empty: return std::size_t{0};
    case Kind::Values: return values_.size();
    case Kind::Strings: return strings_.size();
    case Kind::Iterator:
    case Kind::ReversibleIterator: return exactLength(iterator_->sizeHint());
    case Kind::Sequence: return length_;
    case Kind::NonEnumerable: return std::nullopt;
    }
    return std::nullopt;
}

ValueIteratorPointer ObjectEnumerator::takeIterator() noexcept {
    return std::move(iterator_);
}

std::vector<Value> ObjectEnumerator::takeValues() {
    return std::move(values_);
}

Value::Value() noexcept : representation_(UndefinedRepresentation{}) {}

Value::Value(Representation representation) noexcept : representation_(std::move(representation)) {}

Value Value::undefined() noexcept { return Value(UndefinedRepresentation{UndefinedType::Default}); }
Value Value::silentUndefined() noexcept { return Value(UndefinedRepresentation{UndefinedType::Silent}); }
Value Value::none() noexcept { return Value(NoneRepresentation{}); }
Value Value::fromBool(bool value) noexcept { return Value(Representation(std::in_place_type<bool>, value)); }
Value Value::fromUInt64(std::uint64_t value) noexcept { return Value(Representation(std::in_place_type<std::uint64_t>, value)); }
Value Value::fromInt64(std::int64_t value) noexcept { return Value(Representation(std::in_place_type<std::int64_t>, value)); }
Value Value::fromDouble(double value) noexcept { return Value(Representation(std::in_place_type<double>, value)); }
Value Value::fromUInt128(UInt128 value) noexcept { return Value(Representation(std::in_place_type<UInt128>, value)); }
Value Value::fromInt128(Int128 value) noexcept { return Value(Representation(std::in_place_type<Int128>, value)); }

Value Value::fromString(std::string_view value) {
    return Value(StringRepresentation{std::make_shared<const std::string>(value), StringType::Normal});
}

Value Value::fromSafeString(std::string value) {
    return Value(StringRepresentation{std::make_shared<const std::string>(std::move(value)), StringType::Safe});
}

Value Value::fromCodePoint(char32_t codePoint) {
    return fromString(unicode::encodeUtf8(codePoint));
}

Value Value::fromBytes(std::vector<std::uint8_t> bytes) {
    return Value(BytesRepresentation{std::make_shared<const std::vector<std::uint8_t>>(std::move(bytes))});
}

Value Value::fromObject(std::shared_ptr<TemplateObject> object) noexcept {
    return Value(Representation(std::in_place_type<std::shared_ptr<TemplateObject>>, std::move(object)));
}

Value Value::fromSequence(std::vector<Value> values) {
    return fromObject(std::make_shared<SequenceObject>(std::move(values)));
}

Value Value::fromInvalid(TemplateError error) {
    return Value(InvalidRepresentation{std::make_shared<const TemplateError>(std::move(error))});
}

Value Value::fromOptional(const std::optional<Value>& value) {
    return value ? *value : none();
}

ValueKind Value::kind() const {
    switch (representation_.index()) {
    case 0: return ValueKind::None;
    case 1: return ValueKind::Undefined;
    case 2: return ValueKind::Bool;
    case 3:
    case 4:
    case 5:
    case 7:
    case 8: return ValueKind::Number;
    case 6: return ValueKind::Invalid;
    case 9: return ValueKind::String;
    case 10: return ValueKind::Bytes;
    default: break;
    }
    switch (std::get<std::shared_ptr<TemplateObject>>(representation_)->representation()) {
    case ObjectRepresentation::Map: return ValueKind::Map;
    case ObjectRepresentation::Seq: return ValueKind::Seq;
    case ObjectRepresentation::Iterable: return ValueKind::Iterable;
    case ObjectRepresentation::Plain: return ValueKind::Plain;
    }
    return ValueKind::Plain;
}

bool Value::isNumber() const noexcept {
    const std::size_t index = representation_.index();
    return index == 3 || index == 4 || index == 5 || index == 7 || index == 8;
}

bool Value::isInteger() const noexcept {
    const std::size_t index = representation_.index();
    return index == 3 || index == 4 || index == 7 || index == 8;
}

bool Value::isKwargs() const noexcept {
    const auto* object = asObject();
    return object != nullptr && dynamic_cast<const KeywordArgumentsObject*>(object->get()) != nullptr;
}

bool Value::isTrue() const {
    return std::visit([](const auto& value) -> bool {
        using Type = std::decay_t<decltype(value)>;
        if (std::is_same_v<Type, bool>) return value;
        if (std::is_same_v<Type, std::uint64_t> || std::is_same_v<Type, std::int64_t>) return value != 0;
        if (std::is_same_v<Type, double>) return value != 0.0;
        if (std::is_same_v<Type, UInt128> || std::is_same_v<Type, Int128>) return !value.isZero();
        if (std::is_same_v<Type, StringRepresentation>) return !value.text->empty();
        if (std::is_same_v<Type, BytesRepresentation>) return !value.bytes->empty();
        if (std::is_same_v<Type, std::shared_ptr<TemplateObject>>) return value->isTrue();
        return false;
    }, representation_);
}

bool Value::isSafe() const noexcept {
    const auto* text = std::get_if<StringRepresentation>(&representation_);
    return text != nullptr && text->type == StringType::Safe;
}

bool Value::isUndefined() const noexcept { return std::holds_alternative<UndefinedRepresentation>(representation_); }

bool Value::isSilentUndefined() const noexcept {
    const auto* undefined = std::get_if<UndefinedRepresentation>(&representation_);
    return undefined != nullptr && undefined->type == UndefinedType::Silent;
}

bool Value::isNone() const noexcept { return std::holds_alternative<NoneRepresentation>(representation_); }
bool Value::isInvalid() const noexcept { return std::holds_alternative<InvalidRepresentation>(representation_); }

std::optional<std::string_view> Value::asString() const noexcept {
    if (const auto* text = std::get_if<StringRepresentation>(&representation_)) return std::string_view(*text->text);
    if (const auto* bytes = std::get_if<BytesRepresentation>(&representation_)) {
        const std::string_view view(reinterpret_cast<const char*>(bytes->bytes->data()), bytes->bytes->size());
        if (unicode::isValidUtf8(view)) return view;
    }
    return std::nullopt;
}

std::optional<std::string> Value::toStringValue() const {
    if (const auto* text = std::get_if<StringRepresentation>(&representation_)) return *text->text;
    if (const auto* bytes = std::get_if<BytesRepresentation>(&representation_)) return lossyUtf8(*bytes->bytes);
    return std::nullopt;
}

std::optional<std::span<const std::uint8_t>> Value::asBytes() const noexcept {
    if (const auto* text = std::get_if<StringRepresentation>(&representation_)) {
        return std::span<const std::uint8_t>(reinterpret_cast<const std::uint8_t*>(text->text->data()), text->text->size());
    }
    if (const auto* bytes = std::get_if<BytesRepresentation>(&representation_)) return std::span<const std::uint8_t>(*bytes->bytes);
    return std::nullopt;
}

const std::shared_ptr<TemplateObject>* Value::asObject() const noexcept {
    return std::get_if<std::shared_ptr<TemplateObject>>(&representation_);
}

std::optional<std::size_t> Value::length() const {
    if (const auto* text = std::get_if<StringRepresentation>(&representation_)) return unicode::codePointCount(*text->text);
    if (const auto* bytes = std::get_if<BytesRepresentation>(&representation_)) return bytes->bytes->size();
    if (const auto* object = asObject()) return (*object)->enumeratorLength();
    return std::nullopt;
}

std::optional<Int128> Value::tryInt128() const noexcept {
    if (const auto* flag = std::get_if<bool>(&representation_)) return Int128(static_cast<std::int64_t>(*flag ? 1 : 0));
    if (const auto* value = std::get_if<std::int64_t>(&representation_)) return Int128(*value);
    if (const auto* value = std::get_if<std::uint64_t>(&representation_)) return Int128(UInt128{*value});
    if (const auto* value = std::get_if<double>(&representation_)) {
        const Int128 truncated = numeric::saturatingInt128FromDouble(*value);
        const auto narrowed = numeric::toInt64(truncated);
        const std::int64_t asInteger = narrowed ? *narrowed : (truncated.isNegative() ? INT64_MIN : INT64_MAX);
        if (static_cast<double>(asInteger) == *value) return Int128(asInteger);
        return std::nullopt;
    }
    if (const auto* value = std::get_if<Int128>(&representation_)) return *value;
    if (const auto* value = std::get_if<UInt128>(&representation_)) return numeric::toInt128(*value);
    return std::nullopt;
}

std::optional<UInt128> Value::tryUInt128() const noexcept {
    if (const auto* value = std::get_if<UInt128>(&representation_)) return *value;
    const auto integer = tryInt128();
    if (!integer) return std::nullopt;
    return numeric::toUInt128(*integer);
}

std::optional<std::int64_t> Value::tryInt64() const noexcept {
    const auto integer = tryInt128();
    if (!integer) return std::nullopt;
    return numeric::toInt64(*integer);
}

std::optional<std::uint64_t> Value::tryUInt64() const noexcept {
    const auto integer = tryUInt128();
    if (!integer || !integer->fitsUInt64()) return std::nullopt;
    return integer->low();
}

std::optional<std::int32_t> Value::tryInt32() const noexcept {
    const auto integer = tryInt64();
    if (!integer || *integer < INT32_MIN || *integer > INT32_MAX) return std::nullopt;
    return static_cast<std::int32_t>(*integer);
}

std::optional<std::size_t> Value::tryUsize() const noexcept {
    const auto integer = tryUInt64();
    if (!integer || *integer > SIZE_MAX) return std::nullopt;
    return static_cast<std::size_t>(*integer);
}

std::optional<std::int64_t> Value::tryIsize() const noexcept {
    return tryInt64();
}

std::optional<bool> Value::tryBool() const noexcept {
    if (const auto* flag = std::get_if<bool>(&representation_)) return *flag;
    return std::nullopt;
}

std::optional<double> Value::tryFloat64() const noexcept {
    if (const auto* value = std::get_if<std::uint64_t>(&representation_)) return static_cast<double>(*value);
    if (const auto* value = std::get_if<std::int64_t>(&representation_)) return static_cast<double>(*value);
    if (const auto* value = std::get_if<UInt128>(&representation_)) return numeric::toDouble(*value);
    if (const auto* value = std::get_if<Int128>(&representation_)) return numeric::toDouble(*value);
    if (const auto* value = std::get_if<double>(&representation_)) return *value;
    return std::nullopt;
}

std::optional<std::size_t> Value::asUsize() const noexcept {
    if (const auto* value = std::get_if<std::int64_t>(&representation_)) {
        if (*value < 0) return std::nullopt;
        return static_cast<std::size_t>(*value);
    }
    if (const auto* value = std::get_if<std::uint64_t>(&representation_)) return static_cast<std::size_t>(*value);
    return tryUsize();
}

Value Value::validate() const {
    if (const auto* invalid = std::get_if<InvalidRepresentation>(&representation_)) throw TemplateError(*invalid->error);
    return *this;
}

Value Value::getAttribute(std::string_view key) const {
    if (isUndefined()) throw TemplateError(TemplateErrorKind::UndefinedError);
    if (const auto* object = asObject()) return (*object)->getValue(fromString(key)).value_or(undefined());
    return undefined();
}

std::optional<Value> Value::getAttributeFast(std::string_view key) const {
    if (const auto* object = asObject()) return (*object)->getValue(fromString(key));
    return std::nullopt;
}

Value Value::getItemByIndex(std::size_t index) const {
    return getItem(fromUInt64(index));
}

Value Value::getItem(const Value& key) const {
    if (isUndefined()) throw TemplateError(TemplateErrorKind::UndefinedError);
    return getItemOptional(key).value_or(undefined());
}

std::optional<Value> Value::getItemOptional(const Value& key) const {
    if (const auto* object = asObject()) {
        const TemplateObject& target = **object;
        switch (target.representation()) {
        case ObjectRepresentation::Map:
        case ObjectRepresentation::Plain:
            return target.getValue(key);
        case ObjectRepresentation::Iterable: {
            if (auto direct = target.getValue(key)) return direct;
            const auto index = indexFromKey(key, [&target] { return target.enumeratorLength(); });
            if (!index) return std::nullopt;
            if (auto iterator = target.tryIterate()) {
                for (std::size_t skipped = 0; skipped < *index; ++skipped) {
                    if (!iterator->next()) return std::nullopt;
                }
                return iterator->next();
            }
            return std::nullopt;
        }
        case ObjectRepresentation::Seq: {
            const auto index = indexFromKey(key, [&target] { return target.enumeratorLength(); });
            return target.getValue(index ? fromUInt64(*index) : key);
        }
        }
        return std::nullopt;
    }
    if (const auto* text = std::get_if<StringRepresentation>(&representation_)) {
        const std::string& value = *text->text;
        const auto index = indexFromKey(key, [&value]() -> std::optional<std::size_t> { return unicode::codePointCount(value); });
        if (!index) return std::nullopt;
        std::size_t offset = 0;
        for (std::size_t position = 0; offset < value.size(); ++position) {
            const unicode::Utf8CodePoint decoded = unicode::decodeCodePointAt(value, offset);
            if (position == *index) return fromCodePoint(decoded.codePoint);
            offset += decoded.byteLength;
        }
        return std::nullopt;
    }
    if (const auto* bytes = std::get_if<BytesRepresentation>(&representation_)) {
        const auto& data = *bytes->bytes;
        const auto index = indexFromKey(key, [&data]() -> std::optional<std::size_t> { return data.size(); });
        if (!index || *index >= data.size()) return std::nullopt;
        return fromUInt64(data[*index]);
    }
    return std::nullopt;
}

ValueIteratorPointer Value::tryIterate() const {
    if (isNone() || isUndefined()) return std::make_unique<EmptyIterator>();
    if (const auto* text = std::get_if<StringRepresentation>(&representation_)) return std::make_unique<CharacterIterator>(text->text);
    if (const auto* object = asObject()) {
        if (auto iterator = (*object)->tryIterate()) return iterator;
    }
    throw TemplateError(TemplateErrorKind::InvalidOperation, std::string(valueKindName(kind())) + " is not iterable");
}

Value Value::reverse() const {
    if (isUndefined() || isNone()) return *this;
    if (const auto* text = std::get_if<StringRepresentation>(&representation_)) {
        std::u32string codePoints = unicode::decodeUtf8(*text->text);
        std::ranges::reverse(codePoints);
        return fromString(unicode::encodeUtf8(codePoints));
    }
    if (const auto* bytes = std::get_if<BytesRepresentation>(&representation_)) {
        std::vector<std::uint8_t> reversed(bytes->bytes->rbegin(), bytes->bytes->rend());
        return fromBytes(std::move(reversed));
    }
    if (const auto* object = asObject()) {
        std::shared_ptr<const TemplateObject> target = *object;
        ObjectEnumerator enumerator = target->enumerate();
        switch (enumerator.kind()) {
        case ObjectEnumerator::Kind::NonEnumerable:
            break;
        case ObjectEnumerator::Kind::Empty:
            return makeIterable([] { return makeEmptyIterator(); });
        case ObjectEnumerator::Kind::Sequence: {
            const std::size_t length = enumerator.sequenceLength();
            return makeIterable([target, length]() -> ValueIteratorPointer {
                return std::make_unique<ReverseSequenceIndexIterator>(target, length);
            });
        }
        case ObjectEnumerator::Kind::Iterator: {
            std::vector<Value> values = collectValues(*enumerator.takeIterator());
            std::ranges::reverse(values);
            return makeIterable([values]() { return makeVectorIterator(values); });
        }
        case ObjectEnumerator::Kind::ReversibleIterator: {
            const Value restart = *this;
            auto pending = std::make_shared<ValueIteratorPointer>(enumerator.takeIterator());
            return makeIterable([pending, restart]() -> ValueIteratorPointer {
                if (*pending) return std::move(*pending);
                try {
                    return restart.reverse().tryIterate();
                }
                catch (const TemplateError& error) {
                    return makeVectorIterator({fromInvalid(error)});
                }
            });
        }
        case ObjectEnumerator::Kind::Strings: {
            std::vector<std::string_view> strings = enumerator.stringValues();
            std::ranges::reverse(strings);
            return makeIterable([strings]() -> ValueIteratorPointer { return std::make_unique<StringListIterator>(strings); });
        }
        case ObjectEnumerator::Kind::Values: {
            std::vector<Value> values = enumerator.takeValues();
            std::ranges::reverse(values);
            return makeIterable([values]() { return makeVectorIterator(values); });
        }
        }
    }
    throw TemplateError(TemplateErrorKind::InvalidOperation, "cannot reverse values of type " + std::string(valueKindName(kind())));
}

Value Value::call(const TemplateState& state, std::span<const Value> arguments) const {
    if (const auto* object = asObject()) return (*object)->call(state, arguments);
    throw TemplateError(TemplateErrorKind::InvalidOperation, "value of type " + std::string(valueKindName(kind())) + " is not callable");
}

Value Value::callMethod(const TemplateState& state, std::string_view name, std::span<const Value> arguments) const {
    try {
        if (const auto* object = asObject()) return (*object)->callMethod(state, name, arguments);
        throw TemplateError(TemplateErrorKind::UnknownMethod);
    }
    catch (TemplateError& error) {
        if (error.kind() == TemplateErrorKind::UnknownMethod && !error.detail()) {
            error.setDetail(std::string(valueKindName(kind())) + " has no method named " + std::string(name));
        }
        throw;
    }
}

Value Value::getPath(std::string_view path) const {
    Value current = *this;
    for (std::string_view part : unicode::splitByPattern(path, ".")) {
        const auto index = numeric::parseUInt128(part, 10);
        if (index && index->fitsUInt64()) current = current.getItemByIndex(static_cast<std::size_t>(index->low()));
        else current = current.getAttribute(part);
    }
    return current;
}

Value Value::getPathOrDefault(std::string_view path, const Value& fallback) const {
    try {
        Value value = getPath(path);
        return value.isUndefined() ? fallback : value;
    }
    catch (const TemplateError&) {
        return fallback;
    }
}

std::string Value::toString() const {
    std::string output;
    text_format::DebugWriter writer(output, false);
    writeDisplay(writer);
    return output;
}

void Value::writeDisplay(text_format::DebugWriter& writer) const {
    std::visit([&writer](const auto& value) {
        using Type = std::decay_t<decltype(value)>;
        if (std::is_same_v<Type, UndefinedRepresentation>) return;
        if (std::is_same_v<Type, bool>) { writer.write(value ? "true" : "false"); return; }
        if (std::is_same_v<Type, std::uint64_t> || std::is_same_v<Type, std::int64_t>) { writer.write(std::to_string(value)); return; }
        if (std::is_same_v<Type, double>) {
            if (std::isnan(value)) { writer.write("NaN"); return; }
            if (std::isinf(value)) { writer.write(value < 0 ? "-inf" : "inf"); return; }
            std::string number = numeric::rustFloatDisplay(value);
            if (number.find('.') == std::string::npos) number.append(".0");
            writer.write(number);
            return;
        }
        if (std::is_same_v<Type, NoneRepresentation>) { writer.write("none"); return; }
        if (std::is_same_v<Type, InvalidRepresentation>) { writer.write("<invalid value: " + value.error->displayText() + ">"); return; }
        if (std::is_same_v<Type, UInt128> || std::is_same_v<Type, Int128>) { writer.write(numeric::toDecimalString(value)); return; }
        if (std::is_same_v<Type, StringRepresentation>) { writer.write(*value.text); return; }
        if (std::is_same_v<Type, BytesRepresentation>) { writer.write(lossyUtf8(*value.bytes)); return; }
        if (std::is_same_v<Type, std::shared_ptr<TemplateObject>>) {
            text_format::DebugWriter plain = writer.withAlternate(false);
            value->render(plain);
        }
    }, representation_);
}

void Value::writeDebug(text_format::DebugWriter& writer) const {
    std::visit([&writer](const auto& value) {
        using Type = std::decay_t<decltype(value)>;
        if (std::is_same_v<Type, UndefinedRepresentation>) { writer.write("undefined"); return; }
        if (std::is_same_v<Type, bool>) { writer.write(value ? "true" : "false"); return; }
        if (std::is_same_v<Type, std::uint64_t> || std::is_same_v<Type, std::int64_t>) { writer.write(std::to_string(value)); return; }
        if (std::is_same_v<Type, double>) { writer.write(numeric::rustFloatDebug(value)); return; }
        if (std::is_same_v<Type, NoneRepresentation>) { writer.write("none"); return; }
        if (std::is_same_v<Type, InvalidRepresentation>) { writer.write("<invalid value: " + value.error->displayText() + ">"); return; }
        if (std::is_same_v<Type, UInt128> || std::is_same_v<Type, Int128>) { writer.write(numeric::toDecimalString(value)); return; }
        if (std::is_same_v<Type, StringRepresentation>) { writer.write(unicode::debugEscapedString(*value.text)); return; }
        if (std::is_same_v<Type, BytesRepresentation>) { writeByteDebug(writer, *value.bytes); return; }
        if (std::is_same_v<Type, std::shared_ptr<TemplateObject>>) value->render(writer);
    }, representation_);
}

void Value::appendHashStream(std::string& stream) const {
    if (isNone() || isUndefined()) {
        stream.push_back('\0');
        return;
    }
    if (const auto* text = std::get_if<StringRepresentation>(&representation_)) {
        stream.append(*text->text);
        stream.push_back(static_cast<char>(0xFF));
        return;
    }
    if (const auto* flag = std::get_if<bool>(&representation_)) {
        stream.push_back(*flag ? '\1' : '\0');
        return;
    }
    if (const auto* invalid = std::get_if<InvalidRepresentation>(&representation_)) {
        appendHashBytes(stream, static_cast<std::uint64_t>(invalid->error->kind()));
        if (invalid->error->detail()) {
            appendHashBytes(stream, 1);
            stream.append(*invalid->error->detail());
            stream.push_back(static_cast<char>(0xFF));
        }
        else {
            appendHashBytes(stream, 0);
        }
        return;
    }
    if (const auto* bytes = std::get_if<BytesRepresentation>(&representation_)) {
        appendHashBytes(stream, bytes->bytes->size());
        stream.append(reinterpret_cast<const char*>(bytes->bytes->data()), bytes->bytes->size());
        return;
    }
    if (const auto* object = asObject()) {
        if (auto pairs = (*object)->tryIteratePairs()) {
            for (const auto& [key, value] : *pairs) {
                key.appendHashStream(stream);
                value.appendHashStream(stream);
            }
        }
        return;
    }
    if (const auto integer = tryInt64()) {
        appendHashBytes(stream, static_cast<std::uint64_t>(*integer));
        return;
    }
    const auto floating = valueAsFloat(*this, true);
    if (floating) {
        std::uint64_t bits = 0;
        std::memcpy(&bits, &*floating, sizeof(bits));
        appendHashBytes(stream, 1);
        appendHashBytes(stream, bits);
    }
    else {
        appendHashBytes(stream, 0);
    }
}

bool operator==(const Value& left, const Value& right) {
    if (left.isNone() && right.isNone()) return true;
    if (left.isUndefined() && right.isUndefined()) return true;
    const auto* leftText = std::get_if<Value::StringRepresentation>(&left.representation());
    const auto* rightText = std::get_if<Value::StringRepresentation>(&right.representation());
    if (leftText != nullptr && rightText != nullptr) return *leftText->text == *rightText->text;
    const auto* leftBytes = std::get_if<Value::BytesRepresentation>(&left.representation());
    const auto* rightBytes = std::get_if<Value::BytesRepresentation>(&right.representation());
    if (leftBytes != nullptr && rightBytes != nullptr) return *leftBytes->bytes == *rightBytes->bytes;
    if (const auto coerced = coerceValues(left, right, false)) {
        if (const auto* floats = std::get_if<CoercedFloats>(&*coerced)) return floats->left == floats->right;
        if (const auto* integers = std::get_if<CoercedIntegers>(&*coerced)) return integers->left == integers->right;
        const auto& strings = std::get<CoercedStrings>(*coerced);
        return strings.left == strings.right;
    }
    const auto* leftObject = left.asObject();
    const auto* rightObject = right.asObject();
    if (leftObject == nullptr || rightObject == nullptr) return false;
    const TemplateObject& a = **leftObject;
    const TemplateObject& b = **rightObject;
    if (&a == &b) return true;
    if (typeid(a) == typeid(b)) {
        if (const auto ordering = a.customCompare(b)) return *ordering == std::strong_ordering::equal;
    }
    const ObjectRepresentation leftRepresentation = a.representation();
    const ObjectRepresentation rightRepresentation = b.representation();
    if (leftRepresentation == ObjectRepresentation::Map && rightRepresentation == ObjectRepresentation::Map) {
        bool needLengthFallback = true;
        const auto leftLength = a.enumeratorLength();
        const auto rightLength = b.enumeratorLength();
        if (leftLength && rightLength) {
            if (*leftLength != *rightLength) return false;
            needLengthFallback = false;
        }
        std::size_t leftCount = 0;
        const auto pairs = a.tryIteratePairs();
        if (!pairs) return false;
        for (const auto& [key, value] : *pairs) {
            ++leftCount;
            const auto other = b.getValue(key);
            if (!other || !(*other == value)) return false;
        }
        if (!needLengthFallback) return true;
        std::size_t rightCount = 0;
        if (auto iterator = b.tryIterate()) {
            while (iterator->next()) ++rightCount;
        }
        return leftCount == rightCount;
    }
    const auto sequenceLike = [](ObjectRepresentation representation) {
        return representation == ObjectRepresentation::Seq || representation == ObjectRepresentation::Iterable;
    };
    if (sequenceLike(leftRepresentation) && sequenceLike(rightRepresentation)) {
        auto leftIterator = a.tryIterate();
        auto rightIterator = b.tryIterate();
        if (!leftIterator || !rightIterator) return false;
        for (;;) {
            auto leftItem = leftIterator->next();
            auto rightItem = rightIterator->next();
            if (!leftItem || !rightItem) return !leftItem && !rightItem;
            if (!(*leftItem == *rightItem)) return false;
        }
    }
    if (leftRepresentation == ObjectRepresentation::Plain && rightRepresentation == ObjectRepresentation::Plain) {
        return left.toString() == right.toString();
    }
    return false;
}

std::strong_ordering Value::compare(const Value& other) const {
    const ValueKind leftKind = kind();
    const ValueKind rightKind = other.kind();
    if (leftKind != rightKind) return leftKind <=> rightKind;
    if (isNone() && other.isNone()) return std::strong_ordering::equal;
    if (isUndefined() && other.isUndefined()) return std::strong_ordering::equal;
    const auto* leftText = std::get_if<StringRepresentation>(&representation_);
    const auto* rightText = std::get_if<StringRepresentation>(&other.representation_);
    if (leftText != nullptr && rightText != nullptr) return leftText->text->compare(*rightText->text) <=> 0;
    const auto* leftBytes = std::get_if<BytesRepresentation>(&representation_);
    const auto* rightBytes = std::get_if<BytesRepresentation>(&other.representation_);
    if (leftBytes != nullptr && rightBytes != nullptr) {
        return std::lexicographical_compare_three_way(leftBytes->bytes->begin(), leftBytes->bytes->end(),
            rightBytes->bytes->begin(), rightBytes->bytes->end());
    }
    if (const auto coerced = coerceValues(*this, other, false)) {
        if (const auto* floats = std::get_if<CoercedFloats>(&*coerced)) return totalFloatOrder(floats->left, floats->right);
        if (const auto* integers = std::get_if<CoercedIntegers>(&*coerced)) return integers->left <=> integers->right;
        const auto& strings = std::get<CoercedStrings>(*coerced);
        return strings.left.compare(strings.right) <=> 0;
    }
    const auto* leftObject = asObject();
    const auto* rightObject = other.asObject();
    if (leftObject == nullptr || rightObject == nullptr) {
        throw TemplateError(TemplateErrorKind::InvalidOperation, "values of kind " + std::string(valueKindName(leftKind)) + " cannot be ordered");
    }
    const TemplateObject& a = **leftObject;
    const TemplateObject& b = **rightObject;
    if (&a == &b) return std::strong_ordering::equal;
    if (typeid(a) == typeid(b)) {
        if (const auto ordering = a.customCompare(b)) return *ordering;
    }
    const ObjectRepresentation leftRepresentation = a.representation();
    const ObjectRepresentation rightRepresentation = b.representation();
    if (leftRepresentation == ObjectRepresentation::Map && rightRepresentation == ObjectRepresentation::Map) {
        const auto leftPairs = a.tryIteratePairs();
        const auto rightPairs = b.tryIteratePairs();
        const std::size_t count = std::min(leftPairs->size(), rightPairs->size());
        for (std::size_t index = 0; index < count; ++index) {
            const auto keyOrder = (*leftPairs)[index].first.compare((*rightPairs)[index].first);
            if (keyOrder != std::strong_ordering::equal) return keyOrder;
            const auto valueOrder = (*leftPairs)[index].second.compare((*rightPairs)[index].second);
            if (valueOrder != std::strong_ordering::equal) return valueOrder;
        }
        return leftPairs->size() <=> rightPairs->size();
    }
    if (leftRepresentation == ObjectRepresentation::Plain && rightRepresentation == ObjectRepresentation::Plain) {
        return toString().compare(other.toString()) <=> 0;
    }
    auto leftIterator = a.tryIterate();
    auto rightIterator = b.tryIterate();
    for (;;) {
        auto leftItem = leftIterator->next();
        auto rightItem = rightIterator->next();
        if (!leftItem) return rightItem ? std::strong_ordering::less : std::strong_ordering::equal;
        if (!rightItem) return std::strong_ordering::greater;
        const auto order = leftItem->compare(*rightItem);
        if (order != std::strong_ordering::equal) return order;
    }
}

const Value* ValueMap::find(const Value& key) const {
    std::string stream;
    key.appendHashStream(stream);
    const auto [begin, end] = hashIndex_.equal_range(stream);
    for (auto position = begin; position != end; ++position) {
        if (entries_[position->second].first == key) return &entries_[position->second].second;
    }
    return nullptr;
}

void ValueMap::insert(Value key, Value value) {
    std::string stream;
    key.appendHashStream(stream);
    const auto [begin, end] = hashIndex_.equal_range(stream);
    for (auto position = begin; position != end; ++position) {
        if (entries_[position->second].first == key) {
            entries_[position->second].second = std::move(value);
            return;
        }
    }
    hashIndex_.emplace(std::move(stream), entries_.size());
    entries_.emplace_back(std::move(key), std::move(value));
}

ObjectRepresentation TemplateObject::representation() const { return ObjectRepresentation::Map; }

std::optional<Value> TemplateObject::getValue(const Value&) const { return std::nullopt; }

ObjectEnumerator TemplateObject::enumerate() const {
    return representation() == ObjectRepresentation::Plain ? ObjectEnumerator::nonEnumerable() : ObjectEnumerator::empty();
}

std::optional<std::size_t> TemplateObject::enumeratorLength() const { return enumerate().queryLength(); }

bool TemplateObject::isTrue() const {
    const auto length = enumeratorLength();
    return !(length && *length == 0);
}

Value TemplateObject::call(const TemplateState&, std::span<const Value>) const {
    throw TemplateError(TemplateErrorKind::InvalidOperation, "object is not callable");
}

Value TemplateObject::callMethod(const TemplateState& state, std::string_view method, std::span<const Value> arguments) const {
    if (auto value = getValue(Value::fromString(method))) return value->call(state, arguments);
    throw TemplateError(TemplateErrorKind::UnknownMethod);
}

std::optional<std::strong_ordering> TemplateObject::customCompare(const TemplateObject&) const { return std::nullopt; }

void TemplateObject::render(text_format::DebugWriter& writer) const {
    const ObjectRepresentation kind = representation();
    if (kind == ObjectRepresentation::Map) {
        const auto pairs = tryIteratePairs().value_or(std::vector<std::pair<Value, Value>>{});
        writer.writeMap(pairs.size(),
            [&pairs](std::size_t index, text_format::DebugWriter& entry) { pairs[index].first.writeDebug(entry); },
            [&pairs](std::size_t index, text_format::DebugWriter& entry) { pairs[index].second.writeDebug(entry); });
        return;
    }
    if ((kind == ObjectRepresentation::Seq || kind == ObjectRepresentation::Iterable) && enumeratorLength()) {
        std::vector<Value> values;
        if (auto iterator = tryIterate()) values = collectValues(*iterator);
        writer.writeList(values.size(), [&values](std::size_t index, text_format::DebugWriter& entry) { values[index].writeDebug(entry); });
        return;
    }
    writeDebug(writer);
}

ValueIteratorPointer TemplateObject::tryIterate() const {
    ObjectEnumerator enumerator = enumerate();
    const std::shared_ptr<const TemplateObject> self = shared_from_this();
    switch (enumerator.kind()) {
    case ObjectEnumerator::Kind::NonEnumerable: return nullptr;
    case ObjectEnumerator::Kind::Empty: return makeEmptyIterator();
    case ObjectEnumerator::Kind::Sequence: return std::make_unique<SequenceIndexIterator>(self, enumerator.sequenceLength());
    case ObjectEnumerator::Kind::Iterator:
    case ObjectEnumerator::Kind::ReversibleIterator: return enumerator.takeIterator();
    case ObjectEnumerator::Kind::Strings: return std::make_unique<StringListIterator>(enumerator.stringValues());
    case ObjectEnumerator::Kind::Values: return makeVectorIterator(enumerator.takeValues());
    }
    return nullptr;
}

std::optional<std::vector<std::pair<Value, Value>>> TemplateObject::tryIteratePairs() const {
    auto iterator = tryIterate();
    if (!iterator) return std::nullopt;
    const bool isMap = representation() == ObjectRepresentation::Map;
    std::vector<std::pair<Value, Value>> pairs;
    std::size_t index = 0;
    while (auto item = iterator->next()) {
        if (isMap) {
            Value value = getValue(*item).value_or(Value::undefined());
            pairs.emplace_back(std::move(*item), std::move(value));
        }
        else {
            pairs.emplace_back(Value::fromUInt64(index), std::move(*item));
        }
        ++index;
    }
    return pairs;
}

SequenceObject::SequenceObject(std::vector<Value> values) noexcept : values_(std::move(values)) {}

ObjectRepresentation SequenceObject::representation() const { return ObjectRepresentation::Seq; }

std::optional<Value> SequenceObject::getValue(const Value& key) const {
    const auto index = key.asUsize();
    if (!index || *index >= values_.size()) return std::nullopt;
    return values_[*index];
}

ObjectEnumerator SequenceObject::enumerate() const { return ObjectEnumerator::sequence(values_.size()); }

void SequenceObject::writeDebug(text_format::DebugWriter& writer) const {
    writer.writeList(values_.size(), [this](std::size_t index, text_format::DebugWriter& entry) { values_[index].writeDebug(entry); });
}

MapObject::MapObject(ValueMap values) noexcept : values_(std::move(values)) {}

std::optional<Value> MapObject::getValue(const Value& key) const {
    if (const Value* value = values_.find(key)) return *value;
    return std::nullopt;
}

ObjectEnumerator MapObject::enumerate() const {
    std::vector<Value> keys;
    keys.reserve(values_.size());
    for (const auto& entry : values_.entries()) keys.push_back(entry.first);
    return ObjectEnumerator::reversibleIterator(std::make_unique<ObjectHoldingIterator>(shared_from_this(), makeVectorIterator(std::move(keys))));
}

std::optional<std::size_t> MapObject::enumeratorLength() const { return values_.size(); }

void MapObject::writeDebug(text_format::DebugWriter& writer) const {
    const auto& entries = values_.entries();
    writer.writeMap(entries.size(),
        [&entries](std::size_t index, text_format::DebugWriter& entry) { entries[index].first.writeDebug(entry); },
        [&entries](std::size_t index, text_format::DebugWriter& entry) { entries[index].second.writeDebug(entry); });
}

KeywordArgumentsObject::KeywordArgumentsObject(ValueMap values) noexcept : values_(std::move(values)) {}

std::optional<Value> KeywordArgumentsObject::getValue(const Value& key) const {
    if (const Value* value = values_.find(key)) return *value;
    return std::nullopt;
}

ObjectEnumerator KeywordArgumentsObject::enumerate() const {
    std::vector<Value> keys;
    keys.reserve(values_.size());
    for (const auto& entry : values_.entries()) keys.push_back(entry.first);
    return ObjectEnumerator::iterator(std::make_unique<ObjectHoldingIterator>(shared_from_this(), makeVectorIterator(std::move(keys))));
}

std::optional<std::size_t> KeywordArgumentsObject::enumeratorLength() const { return values_.size(); }

void KeywordArgumentsObject::writeDebug(text_format::DebugWriter& writer) const {
    const auto& entries = values_.entries();
    writer.writeTuple("KwargsValues", 1, [&entries](std::size_t, text_format::DebugWriter& field) {
        field.writeMap(entries.size(),
            [&entries](std::size_t index, text_format::DebugWriter& entry) { entries[index].first.writeDebug(entry); },
            [&entries](std::size_t index, text_format::DebugWriter& entry) { entries[index].second.writeDebug(entry); });
    });
}

IterableObject::IterableObject(IteratorFactory factory) noexcept : factory_(std::move(factory)) {}

ObjectRepresentation IterableObject::representation() const { return ObjectRepresentation::Iterable; }

ObjectEnumerator IterableObject::enumerate() const {
    return ObjectEnumerator::iterator(std::make_unique<ObjectHoldingIterator>(shared_from_this(), factory_()));
}

void IterableObject::writeDebug(text_format::DebugWriter& writer) const {
    writer.write("<iterator>");
}

FunctionObject::FunctionObject(std::string debugName, NativeFunction function) noexcept
    : debugName_(std::move(debugName)), function_(std::move(function)) {}

ObjectRepresentation FunctionObject::representation() const { return ObjectRepresentation::Plain; }

Value FunctionObject::call(const TemplateState& state, std::span<const Value> arguments) const {
    return function_(state, arguments);
}

void FunctionObject::writeDebug(text_format::DebugWriter& writer) const {
    writer.write(debugName_.empty() ? std::string_view("function") : std::string_view(debugName_));
}

KeywordArguments::KeywordArguments(std::shared_ptr<const KeywordArgumentsObject> values) noexcept : values_(std::move(values)) {}

std::optional<KeywordArguments> KeywordArguments::extract(const Value& value) {
    const auto* object = value.asObject();
    if (object == nullptr) return std::nullopt;
    auto keywordObject = std::dynamic_pointer_cast<const KeywordArgumentsObject>(*object);
    if (!keywordObject) return std::nullopt;
    return KeywordArguments(std::move(keywordObject));
}

KeywordArguments KeywordArguments::emptyArguments() {
    return KeywordArguments(std::make_shared<const KeywordArgumentsObject>(ValueMap{}));
}

Value KeywordArguments::wrap(ValueMap values) {
    return Value::fromObject(std::make_shared<KeywordArgumentsObject>(std::move(values)));
}

const Value* KeywordArguments::peek(std::string_view key) const {
    return values_->values().find(Value::fromString(key));
}

const Value* KeywordArguments::get(std::string_view key) {
    const Value* value = peek(key);
    markUsed(key);
    return value;
}

bool KeywordArguments::has(std::string_view key) const {
    return peek(key) != nullptr;
}

void KeywordArguments::markUsed(std::string_view key) {
    if (std::ranges::find(used_, key) == used_.end()) used_.emplace_back(key);
}

void KeywordArguments::assertAllUsed() const {
    for (const auto& entry : values_->values().entries()) {
        const auto key = entry.first.asString();
        if (!key) throw TemplateError(TemplateErrorKind::InvalidOperation, "non string keys passed to kwargs");
        if (std::ranges::find(used_, *key) == used_.end()) {
            throw TemplateError(TemplateErrorKind::TooManyArguments, "unknown keyword argument '" + std::string(*key) + "'");
        }
    }
}

Value makeIterable(IteratorFactory factory) {
    return Value::fromObject(std::make_shared<IterableObject>(std::move(factory)));
}

Value makeFunction(std::string debugName, NativeFunction function) {
    return Value::fromObject(std::make_shared<FunctionObject>(std::move(debugName), std::move(function)));
}

Value makeMap(ValueMap values) {
    return Value::fromObject(std::make_shared<MapObject>(std::move(values)));
}

ValueIteratorPointer makeVectorIterator(std::vector<Value> values) {
    return std::make_unique<VectorIterator>(std::move(values));
}

ValueIteratorPointer makeEmptyIterator() {
    return std::make_unique<EmptyIterator>();
}

ValueIteratorPointer makeLengthWrappedIterator(std::size_t length, ValueIteratorPointer iterator) {
    return std::make_unique<LengthWrappedIterator>(length, std::move(iterator));
}

ValueIteratorPointer makeSkipTakeStepIterator(ValueIteratorPointer iterator, std::size_t skip, std::size_t take, std::size_t step) {
    return std::make_unique<SkipTakeStepIterator>(std::move(iterator), skip, take, step);
}

ValueIteratorPointer makeChainIterator(ValueIteratorPointer first, ValueIteratorPointer second) {
    return std::make_unique<ChainIterator>(std::move(first), std::move(second));
}

ValueIteratorPointer makeGeneratorIterator(std::function<std::optional<Value>()> generator) {
    return std::make_unique<GeneratorIterator>(std::move(generator));
}

std::vector<Value> collectValues(ValueIterator& iterator) {
    std::vector<Value> values;
    const SizeHint hint = iterator.sizeHint();
    values.reserve(std::min<std::size_t>(hint.lower, 1024));
    while (auto value = iterator.next()) values.push_back(std::move(*value));
    return values;
}

}
