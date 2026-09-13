#pragma once

#include <compare>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <unordered_map>
#include <utility>
#include <variant>
#include <vector>

#include "chat_template/template_error.h"
#include "numeric/int128.h"
#include "text_format/debug_writer.h"

namespace eversoul::native::chat_template {

class TemplateState;
class TemplateObject;
class Value;

enum class ValueKind { Undefined, None, Bool, Number, String, Bytes, Seq, Map, Iterable, Plain, Invalid };
enum class ObjectRepresentation { Plain, Map, Seq, Iterable };
enum class StringType { Normal, Safe };
enum class UndefinedType { Default, Silent };

[[nodiscard]] std::string_view valueKindName(ValueKind kind) noexcept;

struct SizeHint {
    std::size_t lower = 0;
    std::optional<std::size_t> upper;
};

[[nodiscard]] std::optional<std::size_t> exactLength(const SizeHint& hint) noexcept;

class ValueIterator {
public:
    virtual ~ValueIterator() = default;
    [[nodiscard]] virtual std::optional<Value> next() = 0;
    [[nodiscard]] virtual SizeHint sizeHint() const = 0;
};

using ValueIteratorPointer = std::unique_ptr<ValueIterator>;

class ObjectEnumerator {
public:
    enum class Kind { NonEnumerable, Empty, Strings, Iterator, ReversibleIterator, Sequence, Values };

    ObjectEnumerator();
    ObjectEnumerator(ObjectEnumerator&&) noexcept;
    ObjectEnumerator& operator=(ObjectEnumerator&&) noexcept;
    ~ObjectEnumerator();

    [[nodiscard]] static ObjectEnumerator nonEnumerable();
    [[nodiscard]] static ObjectEnumerator empty();
    [[nodiscard]] static ObjectEnumerator strings(std::vector<std::string_view> values);
    [[nodiscard]] static ObjectEnumerator iterator(ValueIteratorPointer iterator);
    [[nodiscard]] static ObjectEnumerator reversibleIterator(ValueIteratorPointer iterator);
    [[nodiscard]] static ObjectEnumerator sequence(std::size_t length);
    [[nodiscard]] static ObjectEnumerator values(std::vector<Value> values);

    [[nodiscard]] Kind kind() const noexcept { return kind_; }
    [[nodiscard]] std::optional<std::size_t> queryLength() const;
    [[nodiscard]] const std::vector<std::string_view>& stringValues() const noexcept { return strings_; }
    [[nodiscard]] ValueIteratorPointer takeIterator() noexcept;
    [[nodiscard]] std::size_t sequenceLength() const noexcept { return length_; }
    [[nodiscard]] std::vector<Value> takeValues();

private:
    Kind kind_ = Kind::Empty;
    std::vector<std::string_view> strings_;
    ValueIteratorPointer iterator_;
    std::size_t length_ = 0;
    std::vector<Value> values_;
};

class Value {
public:
    struct NoneRepresentation {
        friend bool operator==(const NoneRepresentation&, const NoneRepresentation&) = default;
    };
    struct UndefinedRepresentation {
        UndefinedType type = UndefinedType::Default;
    };
    struct StringRepresentation {
        std::shared_ptr<const std::string> text;
        StringType type = StringType::Normal;
    };
    struct BytesRepresentation {
        std::shared_ptr<const std::vector<std::uint8_t>> bytes;
    };
    struct InvalidRepresentation {
        std::shared_ptr<const TemplateError> error;
    };

    using Representation = std::variant<
        NoneRepresentation,
        UndefinedRepresentation,
        bool,
        std::uint64_t,
        std::int64_t,
        double,
        InvalidRepresentation,
        numeric::UInt128,
        numeric::Int128,
        StringRepresentation,
        BytesRepresentation,
        std::shared_ptr<TemplateObject>>;

    Value() noexcept;

    [[nodiscard]] static Value undefined() noexcept;
    [[nodiscard]] static Value silentUndefined() noexcept;
    [[nodiscard]] static Value none() noexcept;
    [[nodiscard]] static Value fromBool(bool value) noexcept;
    [[nodiscard]] static Value fromUInt64(std::uint64_t value) noexcept;
    [[nodiscard]] static Value fromInt64(std::int64_t value) noexcept;
    [[nodiscard]] static Value fromDouble(double value) noexcept;
    [[nodiscard]] static Value fromUInt128(numeric::UInt128 value) noexcept;
    [[nodiscard]] static Value fromInt128(numeric::Int128 value) noexcept;
    [[nodiscard]] static Value fromString(std::string_view value);
    [[nodiscard]] static Value fromSafeString(std::string value);
    [[nodiscard]] static Value fromCodePoint(char32_t codePoint);
    [[nodiscard]] static Value fromBytes(std::vector<std::uint8_t> bytes);
    [[nodiscard]] static Value fromObject(std::shared_ptr<TemplateObject> object) noexcept;
    [[nodiscard]] static Value fromSequence(std::vector<Value> values);
    [[nodiscard]] static Value fromInvalid(TemplateError error);
    [[nodiscard]] static Value fromOptional(const std::optional<Value>& value);

    [[nodiscard]] const Representation& representation() const noexcept { return representation_; }
    [[nodiscard]] ValueKind kind() const;
    [[nodiscard]] bool isNumber() const noexcept;
    [[nodiscard]] bool isInteger() const noexcept;
    [[nodiscard]] bool isKwargs() const noexcept;
    [[nodiscard]] bool isTrue() const;
    [[nodiscard]] bool isSafe() const noexcept;
    [[nodiscard]] bool isUndefined() const noexcept;
    [[nodiscard]] bool isSilentUndefined() const noexcept;
    [[nodiscard]] bool isNone() const noexcept;
    [[nodiscard]] bool isInvalid() const noexcept;

    [[nodiscard]] std::optional<std::string_view> asString() const noexcept;
    [[nodiscard]] std::optional<std::string> toStringValue() const;
    [[nodiscard]] std::optional<std::span<const std::uint8_t>> asBytes() const noexcept;
    [[nodiscard]] const std::shared_ptr<TemplateObject>* asObject() const noexcept;
    [[nodiscard]] std::optional<std::size_t> length() const;

    [[nodiscard]] std::optional<numeric::Int128> tryInt128() const noexcept;
    [[nodiscard]] std::optional<numeric::UInt128> tryUInt128() const noexcept;
    [[nodiscard]] std::optional<std::int64_t> tryInt64() const noexcept;
    [[nodiscard]] std::optional<std::uint64_t> tryUInt64() const noexcept;
    [[nodiscard]] std::optional<std::int32_t> tryInt32() const noexcept;
    [[nodiscard]] std::optional<std::size_t> tryUsize() const noexcept;
    [[nodiscard]] std::optional<std::int64_t> tryIsize() const noexcept;
    [[nodiscard]] std::optional<bool> tryBool() const noexcept;
    [[nodiscard]] std::optional<double> tryFloat64() const noexcept;
    [[nodiscard]] std::optional<std::size_t> asUsize() const noexcept;

    [[nodiscard]] Value validate() const;
    [[nodiscard]] Value getAttribute(std::string_view key) const;
    [[nodiscard]] std::optional<Value> getAttributeFast(std::string_view key) const;
    [[nodiscard]] Value getItemByIndex(std::size_t index) const;
    [[nodiscard]] Value getItem(const Value& key) const;
    [[nodiscard]] std::optional<Value> getItemOptional(const Value& key) const;
    [[nodiscard]] ValueIteratorPointer tryIterate() const;
    [[nodiscard]] Value reverse() const;
    [[nodiscard]] Value call(const TemplateState& state, std::span<const Value> arguments) const;
    [[nodiscard]] Value callMethod(const TemplateState& state, std::string_view name, std::span<const Value> arguments) const;
    [[nodiscard]] Value getPath(std::string_view path) const;
    [[nodiscard]] Value getPathOrDefault(std::string_view path, const Value& fallback) const;

    [[nodiscard]] std::string toString() const;
    void writeDisplay(text_format::DebugWriter& writer) const;
    void writeDebug(text_format::DebugWriter& writer) const;
    void appendHashStream(std::string& stream) const;
    [[nodiscard]] std::strong_ordering compare(const Value& other) const;

    friend bool operator==(const Value& left, const Value& right);

private:
    explicit Value(Representation representation) noexcept;

    Representation representation_;
};

class ValueMap {
public:
    [[nodiscard]] const Value* find(const Value& key) const;
    void insert(Value key, Value value);
    [[nodiscard]] std::size_t size() const noexcept { return entries_.size(); }
    [[nodiscard]] bool empty() const noexcept { return entries_.empty(); }
    [[nodiscard]] const std::vector<std::pair<Value, Value>>& entries() const noexcept { return entries_; }

private:
    std::vector<std::pair<Value, Value>> entries_;
    std::unordered_multimap<std::string, std::size_t> hashIndex_;
};

class TemplateObject : public std::enable_shared_from_this<TemplateObject> {
public:
    virtual ~TemplateObject() = default;

    [[nodiscard]] virtual ObjectRepresentation representation() const;
    [[nodiscard]] virtual std::optional<Value> getValue(const Value& key) const;
    [[nodiscard]] virtual ObjectEnumerator enumerate() const;
    [[nodiscard]] virtual std::optional<std::size_t> enumeratorLength() const;
    [[nodiscard]] virtual bool isTrue() const;
    [[nodiscard]] virtual Value call(const TemplateState& state, std::span<const Value> arguments) const;
    [[nodiscard]] virtual Value callMethod(const TemplateState& state, std::string_view method, std::span<const Value> arguments) const;
    [[nodiscard]] virtual std::optional<std::strong_ordering> customCompare(const TemplateObject& other) const;
    virtual void render(text_format::DebugWriter& writer) const;
    virtual void writeDebug(text_format::DebugWriter& writer) const = 0;

    [[nodiscard]] ValueIteratorPointer tryIterate() const;
    [[nodiscard]] std::optional<std::vector<std::pair<Value, Value>>> tryIteratePairs() const;
};

class SequenceObject final : public TemplateObject {
public:
    explicit SequenceObject(std::vector<Value> values) noexcept;
    [[nodiscard]] ObjectRepresentation representation() const override;
    [[nodiscard]] std::optional<Value> getValue(const Value& key) const override;
    [[nodiscard]] ObjectEnumerator enumerate() const override;
    void writeDebug(text_format::DebugWriter& writer) const override;
    [[nodiscard]] const std::vector<Value>& values() const noexcept { return values_; }

private:
    std::vector<Value> values_;
};

class MapObject final : public TemplateObject {
public:
    explicit MapObject(ValueMap values) noexcept;
    [[nodiscard]] std::optional<Value> getValue(const Value& key) const override;
    [[nodiscard]] ObjectEnumerator enumerate() const override;
    [[nodiscard]] std::optional<std::size_t> enumeratorLength() const override;
    void writeDebug(text_format::DebugWriter& writer) const override;
    [[nodiscard]] const ValueMap& values() const noexcept { return values_; }

private:
    ValueMap values_;
};

class KeywordArgumentsObject final : public TemplateObject {
public:
    explicit KeywordArgumentsObject(ValueMap values) noexcept;
    [[nodiscard]] std::optional<Value> getValue(const Value& key) const override;
    [[nodiscard]] ObjectEnumerator enumerate() const override;
    [[nodiscard]] std::optional<std::size_t> enumeratorLength() const override;
    void writeDebug(text_format::DebugWriter& writer) const override;
    [[nodiscard]] const ValueMap& values() const noexcept { return values_; }

private:
    ValueMap values_;
};

using IteratorFactory = std::function<ValueIteratorPointer()>;

class IterableObject final : public TemplateObject {
public:
    explicit IterableObject(IteratorFactory factory) noexcept;
    [[nodiscard]] ObjectRepresentation representation() const override;
    [[nodiscard]] ObjectEnumerator enumerate() const override;
    void writeDebug(text_format::DebugWriter& writer) const override;

private:
    IteratorFactory factory_;
};

using NativeFunction = std::function<Value(const TemplateState&, std::span<const Value>)>;

class FunctionObject final : public TemplateObject {
public:
    FunctionObject(std::string debugName, NativeFunction function) noexcept;
    [[nodiscard]] ObjectRepresentation representation() const override;
    [[nodiscard]] Value call(const TemplateState& state, std::span<const Value> arguments) const override;
    void writeDebug(text_format::DebugWriter& writer) const override;

private:
    std::string debugName_;
    NativeFunction function_;
};

class KeywordArguments {
public:
    [[nodiscard]] static std::optional<KeywordArguments> extract(const Value& value);
    [[nodiscard]] static KeywordArguments emptyArguments();
    [[nodiscard]] static Value wrap(ValueMap values);

    [[nodiscard]] const Value* peek(std::string_view key) const;
    [[nodiscard]] const Value* get(std::string_view key);
    [[nodiscard]] bool has(std::string_view key) const;
    void markUsed(std::string_view key);
    void assertAllUsed() const;
    [[nodiscard]] const ValueMap& values() const noexcept { return values_->values(); }

private:
    explicit KeywordArguments(std::shared_ptr<const KeywordArgumentsObject> values) noexcept;

    std::shared_ptr<const KeywordArgumentsObject> values_;
    std::vector<std::string> used_;
};

[[nodiscard]] Value makeIterable(IteratorFactory factory);
[[nodiscard]] Value makeFunction(std::string debugName, NativeFunction function);
[[nodiscard]] Value makeMap(ValueMap values);
[[nodiscard]] ValueIteratorPointer makeVectorIterator(std::vector<Value> values);
[[nodiscard]] ValueIteratorPointer makeEmptyIterator();
[[nodiscard]] ValueIteratorPointer makeLengthWrappedIterator(std::size_t length, ValueIteratorPointer iterator);
[[nodiscard]] ValueIteratorPointer makeSkipTakeStepIterator(ValueIteratorPointer iterator, std::size_t skip, std::size_t take, std::size_t step);
[[nodiscard]] ValueIteratorPointer makeChainIterator(ValueIteratorPointer first, ValueIteratorPointer second);
[[nodiscard]] ValueIteratorPointer makeGeneratorIterator(std::function<std::optional<Value>()> generator);
[[nodiscard]] std::vector<Value> collectValues(ValueIterator& iterator);

}
