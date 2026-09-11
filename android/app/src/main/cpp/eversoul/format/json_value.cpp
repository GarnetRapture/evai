#include "eversoul/format/json_value.h"

#include <cctype>
#include <charconv>
#include <utility>

#include "eversoul/unicode/code_point_category.h"

namespace eversoul::format {
namespace {

constexpr std::size_t kMaxNestingDepth = 128;

class JsonParser {
public:
    explicit JsonParser(std::string_view text) noexcept : text_(text) {}

    [[nodiscard]] core::Result<JsonValue> parse() {
        skipWhitespace();
        auto value = parseValue(0);
        if (!value) {
            return value;
        }
        skipWhitespace();
        if (position_ != text_.size()) {
            return core::fail(core::FailureCode::InvalidModelFile, "json_trailing_content");
        }
        return value;
    }

private:
    [[nodiscard]] core::Result<JsonValue> parseValue(std::size_t depth) {
        if (depth > kMaxNestingDepth) {
            return core::fail(core::FailureCode::InvalidModelFile, "json_too_deep");
        }
        if (position_ >= text_.size()) {
            return core::fail(core::FailureCode::InvalidModelFile, "json_unexpected_end");
        }
        switch (text_[position_]) {
            case '{':
                return parseObject(depth);
            case '[':
                return parseArray(depth);
            case '"': {
                auto text = parseString();
                if (!text) {
                    return std::unexpected(text.error());
                }
                return JsonValue(std::move(*text));
            }
            case 't':
            case 'f':
                return parseBoolean();
            case 'n':
                return parseNull();
            default:
                return parseNumber();
        }
    }

    [[nodiscard]] core::Result<JsonValue> parseObject(std::size_t depth) {
        ++position_;
        JsonObject object;
        skipWhitespace();
        if (consume('}')) {
            return JsonValue(std::move(object));
        }
        while (true) {
            skipWhitespace();
            if (position_ >= text_.size() || text_[position_] != '"') {
                return core::fail(core::FailureCode::InvalidModelFile, "json_expected_key");
            }
            auto key = parseString();
            if (!key) {
                return std::unexpected(key.error());
            }
            skipWhitespace();
            if (!consume(':')) {
                return core::fail(core::FailureCode::InvalidModelFile, "json_expected_colon");
            }
            skipWhitespace();
            auto value = parseValue(depth + 1);
            if (!value) {
                return value;
            }
            object.insert_or_assign(std::move(*key), std::move(*value));
            skipWhitespace();
            if (consume(',')) {
                continue;
            }
            if (consume('}')) {
                return JsonValue(std::move(object));
            }
            return core::fail(core::FailureCode::InvalidModelFile, "json_expected_comma_or_brace");
        }
    }

    [[nodiscard]] core::Result<JsonValue> parseArray(std::size_t depth) {
        ++position_;
        JsonArray array;
        skipWhitespace();
        if (consume(']')) {
            return JsonValue(std::move(array));
        }
        while (true) {
            skipWhitespace();
            auto value = parseValue(depth + 1);
            if (!value) {
                return value;
            }
            array.push_back(std::move(*value));
            skipWhitespace();
            if (consume(',')) {
                continue;
            }
            if (consume(']')) {
                return JsonValue(std::move(array));
            }
            return core::fail(core::FailureCode::InvalidModelFile, "json_expected_comma_or_bracket");
        }
    }

    [[nodiscard]] core::Result<std::string> parseString() {
        ++position_;
        std::string result;
        while (position_ < text_.size()) {
            const char character = text_[position_++];
            if (character == '"') {
                return result;
            }
            if (character != '\\') {
                result.push_back(character);
                continue;
            }
            if (position_ >= text_.size()) {
                break;
            }
            const char escape = text_[position_++];
            switch (escape) {
                case '"':
                case '\\':
                case '/':
                    result.push_back(escape);
                    break;
                case 'b':
                    result.push_back('\b');
                    break;
                case 'f':
                    result.push_back('\f');
                    break;
                case 'n':
                    result.push_back('\n');
                    break;
                case 'r':
                    result.push_back('\r');
                    break;
                case 't':
                    result.push_back('\t');
                    break;
                case 'u': {
                    auto decoded = parseUnicodeEscape();
                    if (!decoded) {
                        return std::unexpected(decoded.error());
                    }
                    unicode::appendUtf8(*decoded, result);
                    break;
                }
                default:
                    return core::fail(core::FailureCode::InvalidModelFile, "json_invalid_escape");
            }
        }
        return core::fail(core::FailureCode::InvalidModelFile, "json_unterminated_string");
    }

    [[nodiscard]] core::Result<char32_t> parseUnicodeEscape() {
        auto first = parseHex4();
        if (!first) {
            return std::unexpected(first.error());
        }
        char32_t codePoint = *first;
        if (codePoint >= 0xD800 && codePoint <= 0xDBFF) {
            if (position_ + 1 >= text_.size() || text_[position_] != '\\' || text_[position_ + 1] != 'u') {
                return core::fail(core::FailureCode::InvalidModelFile, "json_unpaired_surrogate");
            }
            position_ += 2;
            auto second = parseHex4();
            if (!second) {
                return std::unexpected(second.error());
            }
            if (*second < 0xDC00 || *second > 0xDFFF) {
                return core::fail(core::FailureCode::InvalidModelFile, "json_invalid_low_surrogate");
            }
            codePoint = 0x10000 + ((codePoint - 0xD800) << 10) + (*second - 0xDC00);
        }
        return codePoint;
    }

    [[nodiscard]] core::Result<char32_t> parseHex4() {
        if (position_ + 4 > text_.size()) {
            return core::fail(core::FailureCode::InvalidModelFile, "json_truncated_unicode_escape");
        }
        char32_t value = 0;
        for (std::size_t offset = 0; offset < 4; ++offset) {
            const char digit = text_[position_++];
            value <<= 4;
            if (digit >= '0' && digit <= '9') {
                value |= static_cast<char32_t>(digit - '0');
            }
            else if (digit >= 'a' && digit <= 'f') {
                value |= static_cast<char32_t>(digit - 'a' + 10);
            }
            else if (digit >= 'A' && digit <= 'F') {
                value |= static_cast<char32_t>(digit - 'A' + 10);
            }
            else {
                return core::fail(core::FailureCode::InvalidModelFile, "json_invalid_hex_digit");
            }
        }
        return value;
    }

    [[nodiscard]] core::Result<JsonValue> parseNumber() {
        const std::size_t start = position_;
        while (position_ < text_.size()) {
            const char character = text_[position_];
            const bool numeric = (character >= '0' && character <= '9') || character == '-' || character == '+' || character == '.' || character == 'e' || character == 'E';
            if (!numeric) {
                break;
            }
            ++position_;
        }
        const std::string_view token = text_.substr(start, position_ - start);
        double value = 0.0;
        const auto result = std::from_chars(token.data(), token.data() + token.size(), value);
        if (result.ec != std::errc() || result.ptr != token.data() + token.size()) {
            return core::fail(core::FailureCode::InvalidModelFile, "json_invalid_number");
        }
        return JsonValue(value);
    }

    [[nodiscard]] core::Result<JsonValue> parseBoolean() {
        if (text_.substr(position_).starts_with("true")) {
            position_ += 4;
            return JsonValue(true);
        }
        if (text_.substr(position_).starts_with("false")) {
            position_ += 5;
            return JsonValue(false);
        }
        return core::fail(core::FailureCode::InvalidModelFile, "json_invalid_literal");
    }

    [[nodiscard]] core::Result<JsonValue> parseNull() {
        if (text_.substr(position_).starts_with("null")) {
            position_ += 4;
            return JsonValue();
        }
        return core::fail(core::FailureCode::InvalidModelFile, "json_invalid_literal");
    }

    void skipWhitespace() {
        while (position_ < text_.size()) {
            const char character = text_[position_];
            if (character != ' ' && character != '\t' && character != '\n' && character != '\r') {
                break;
            }
            ++position_;
        }
    }

    [[nodiscard]] bool consume(char expected) {
        if (position_ < text_.size() && text_[position_] == expected) {
            ++position_;
            return true;
        }
        return false;
    }

    std::string_view text_;
    std::size_t position_ = 0;
};

}

JsonValue::JsonValue(bool value) noexcept : kind_(JsonKind::Boolean), boolean_(value) {}
JsonValue::JsonValue(double value) noexcept : kind_(JsonKind::Number), number_(value) {}
JsonValue::JsonValue(std::string value) noexcept : kind_(JsonKind::String), string_(std::move(value)) {}
JsonValue::JsonValue(JsonArray value) noexcept : kind_(JsonKind::Array), array_(std::make_shared<JsonArray>(std::move(value))) {}
JsonValue::JsonValue(JsonObject value) noexcept : kind_(JsonKind::Object), object_(std::make_shared<JsonObject>(std::move(value))) {}

core::Result<bool> JsonValue::asBoolean() const {
    if (kind_ != JsonKind::Boolean) {
        return core::fail(core::FailureCode::InvalidModelFile, "json_not_boolean");
    }
    return boolean_;
}

core::Result<double> JsonValue::asNumber() const {
    if (kind_ != JsonKind::Number) {
        return core::fail(core::FailureCode::InvalidModelFile, "json_not_number");
    }
    return number_;
}

core::Result<std::string_view> JsonValue::asString() const {
    if (kind_ != JsonKind::String) {
        return core::fail(core::FailureCode::InvalidModelFile, "json_not_string");
    }
    return std::string_view(string_);
}

core::Result<const JsonArray*> JsonValue::asArray() const {
    if (kind_ != JsonKind::Array) {
        return core::fail(core::FailureCode::InvalidModelFile, "json_not_array");
    }
    return array_.get();
}

core::Result<const JsonObject*> JsonValue::asObject() const {
    if (kind_ != JsonKind::Object) {
        return core::fail(core::FailureCode::InvalidModelFile, "json_not_object");
    }
    return object_.get();
}

const JsonValue* JsonValue::find(std::string_view key) const {
    if (kind_ != JsonKind::Object) {
        return nullptr;
    }
    const auto match = object_->find(key);
    return match == object_->end() ? nullptr : &match->second;
}

core::Result<JsonValue> parseJson(std::string_view text) {
    JsonParser parser(text);
    return parser.parse();
}

}
