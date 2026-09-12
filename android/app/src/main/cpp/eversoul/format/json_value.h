#pragma once

#include <cstddef>
#include <cstdint>
#include <map>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

#include "eversoul/core/failure.h"

namespace eversoul::format {

class JsonValue;
using JsonArray = std::vector<JsonValue>;
using JsonObject = std::map<std::string, JsonValue, std::less<>>;

enum class JsonKind : std::uint8_t {
    Null,
    Boolean,
    Number,
    String,
    Array,
    Object,
};

class JsonValue {
public:
    JsonValue() noexcept = default;
    explicit JsonValue(bool value) noexcept;
    explicit JsonValue(double value) noexcept;
    explicit JsonValue(std::string value) noexcept;
    explicit JsonValue(JsonArray value) noexcept;
    explicit JsonValue(JsonObject value) noexcept;

    [[nodiscard]] JsonKind kind() const noexcept { return kind_; }
    [[nodiscard]] bool isObject() const noexcept { return kind_ == JsonKind::Object; }
    [[nodiscard]] bool isArray() const noexcept { return kind_ == JsonKind::Array; }
    [[nodiscard]] bool isString() const noexcept { return kind_ == JsonKind::String; }

    [[nodiscard]] core::Result<bool> asBoolean() const;
    [[nodiscard]] core::Result<double> asNumber() const;
    [[nodiscard]] core::Result<std::string_view> asString() const;
    [[nodiscard]] core::Result<const JsonArray*> asArray() const;
    [[nodiscard]] core::Result<const JsonObject*> asObject() const;

    [[nodiscard]] const JsonValue* find(std::string_view key) const;

private:
    JsonKind kind_ = JsonKind::Null;
    bool boolean_ = false;
    double number_ = 0.0;
    std::string string_;
    std::shared_ptr<JsonArray> array_;
    std::shared_ptr<JsonObject> object_;
};

[[nodiscard]] core::Result<JsonValue> parseJson(std::string_view text);

}
