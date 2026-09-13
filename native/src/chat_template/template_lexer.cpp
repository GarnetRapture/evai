#include "chat_template/template_lexer.h"

#include <algorithm>
#include <charconv>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <system_error>
#include <utility>

#include "chat_template/template_error.h"
#include "numeric/int128.h"
#include "unicode/unicode_properties.h"
#include "unicode/utf8_text.h"

namespace eversoul::native::chat_template {
namespace {

constexpr std::string_view kVariableEnd = "}}";
constexpr std::string_view kBlockStart = "{%";
constexpr std::string_view kBlockEnd = "%}";
constexpr std::string_view kCommentEnd = "#}";

bool isNewline(char32_t codePoint) noexcept {
    return codePoint == U'\r' || codePoint == U'\n';
}

bool isAsciiWhitespaceByte(char byte) noexcept {
    return byte == ' ' || byte == '\t' || byte == '\n' || byte == '\x0C' || byte == '\r';
}

std::string_view trimEndWhitespaceExceptNewline(std::string_view text) noexcept {
    std::size_t end = text.size();
    while (end > 0) {
        const unicode::Utf8CodePoint decoded = unicode::decodeCodePointBefore(text, end);
        if (!unicode::isWhitespace(decoded.codePoint) || isNewline(decoded.codePoint)) break;
        end -= decoded.byteLength;
    }
    return text.substr(0, end);
}

std::string_view lstripBlock(std::string_view text) noexcept {
    const std::string_view trimmed = trimEndWhitespaceExceptNewline(text);
    if (trimmed.empty() || trimmed.back() == '\n') return trimmed;
    return text;
}

struct FoundMarker {
    std::size_t start;
    int marker;
    std::size_t length;
    int whitespace;
};

std::optional<FoundMarker> findStartMarker(std::string_view text) noexcept {
    std::size_t offset = 0;
    for (;;) {
        const std::size_t index = text.find('{', offset);
        if (index == std::string_view::npos) return std::nullopt;
        int marker = -1;
        if (index + 1 < text.size()) {
            const char next = text[index + 1];
            if (next == '{') marker = 0;
            else if (next == '%') marker = 1;
            else if (next == '#') marker = 2;
        }
        if (marker < 0) {
            offset = index + 1;
            continue;
        }
        int whitespace = 0;
        if (index + 2 < text.size()) {
            if (text[index + 2] == '-') whitespace = 2;
            else if (text[index + 2] == '+') whitespace = 1;
        }
        return FoundMarker{index, marker, 2U + (whitespace == 0 ? 0U : 1U), whitespace};
    }
}

struct BasicTag {
    std::size_t length;
    int whitespace;
};

std::optional<BasicTag> skipBasicTag(std::string_view blockText, std::string_view name, std::string_view blockEnd, bool skipWhitespaceControl) {
    std::string_view pointer = blockText;
    if (skipWhitespaceControl && !pointer.empty() && (pointer.front() == '-' || pointer.front() == '+')) pointer.remove_prefix(1);
    while (!pointer.empty() && isAsciiWhitespaceByte(pointer.front())) pointer.remove_prefix(1);
    if (!pointer.starts_with(name)) return std::nullopt;
    pointer.remove_prefix(name.size());
    while (!pointer.empty() && isAsciiWhitespaceByte(pointer.front())) pointer.remove_prefix(1);
    int whitespace = 0;
    if (!pointer.empty() && pointer.front() == '-') {
        pointer.remove_prefix(1);
        whitespace = 2;
    }
    else if (!pointer.empty() && pointer.front() == '+') {
        pointer.remove_prefix(1);
        whitespace = 1;
    }
    if (!pointer.starts_with(blockEnd)) return std::nullopt;
    pointer.remove_prefix(blockEnd.size());
    return BasicTag{blockText.size() - pointer.size(), whitespace};
}

class Unescaper {
public:
    std::string run(std::string_view text) {
        std::u32string characters = unicode::decodeUtf8(text);
        std::size_t index = 0;
        while (index < characters.size()) {
            const char32_t character = characters[index++];
            if (character != U'\\') {
                pushCharacter(character);
                continue;
            }
            if (index >= characters.size()) throw TemplateError(TemplateErrorKind::BadEscape);
            const char32_t escaped = characters[index++];
            switch (escaped) {
            case U'"': case U'\\': case U'/': case U'\'': pushCharacter(escaped); break;
            case U'b': pushCharacter(U'\x08'); break;
            case U'f': pushCharacter(U'\x0C'); break;
            case U'n': pushCharacter(U'\n'); break;
            case U'r': pushCharacter(U'\r'); break;
            case U't': pushCharacter(U'\t'); break;
            case U'u': {
                std::string hex;
                for (int count = 0; count < 4; ++count) {
                    if (index < characters.size()) unicode::appendUtf8(hex, characters[index++]);
                    else hex.push_back('\0');
                }
                pushUtf16(static_cast<std::uint16_t>(parseRadix(hex, 16, 0xFFFF)));
                break;
            }
            case U'x': {
                std::string hex;
                for (int count = 0; count < 2 && index < characters.size(); ++count) unicode::appendUtf8(hex, characters[index++]);
                if (hex.size() != 2) throw TemplateError(TemplateErrorKind::BadEscape);
                pushCharacter(static_cast<char32_t>(parseRadix(hex, 16, 0xFF)));
                break;
            }
            default:
                if (escaped >= U'0' && escaped <= U'7') {
                    std::string octal(1, static_cast<char>(escaped));
                    for (int count = 0; count < 2 && index < characters.size(); ++count) {
                        const char32_t next = characters[index];
                        if (next < U'0' || next > U'7') break;
                        octal.push_back(static_cast<char>(next));
                        ++index;
                    }
                    pushCharacter(static_cast<char32_t>(parseRadix(octal, 8, 0xFF)));
                    break;
                }
                throw TemplateError(TemplateErrorKind::BadEscape);
            }
        }
        if (pendingSurrogate_ != 0) throw TemplateError(TemplateErrorKind::BadEscape);
        return output_;
    }

private:
    static std::uint32_t parseRadix(std::string_view text, unsigned radix, std::uint32_t maximum) {
        const auto value = numeric::parseUInt128(text, radix);
        if (!value || !value->fitsUInt64() || value->low() > maximum) throw TemplateError(TemplateErrorKind::BadEscape);
        return static_cast<std::uint32_t>(value->low());
    }

    void pushUtf16(std::uint16_t unit) {
        const bool surrogate = unit >= 0xD800U && unit <= 0xDFFFU;
        if (pendingSurrogate_ == 0 && !surrogate) {
            unicode::appendUtf8(output_, unit);
            return;
        }
        if (!surrogate) throw TemplateError(TemplateErrorKind::BadEscape);
        if (pendingSurrogate_ == 0) {
            pendingSurrogate_ = unit;
            return;
        }
        const std::uint16_t high = pendingSurrogate_;
        if (high < 0xD800U || high > 0xDBFFU || unit < 0xDC00U) throw TemplateError(TemplateErrorKind::BadEscape);
        unicode::appendUtf8(output_, 0x10000U + ((static_cast<char32_t>(high) - 0xD800U) << 10U) + (unit - 0xDC00U));
        pendingSurrogate_ = 0;
    }

    void pushCharacter(char32_t character) {
        if (pendingSurrogate_ != 0) throw TemplateError(TemplateErrorKind::BadEscape);
        unicode::appendUtf8(output_, character);
    }

    std::string output_;
    std::uint16_t pendingSurrogate_ = 0;
};

}

std::string unescapeTemplateString(std::string_view text) {
    return Unescaper().run(text);
}

std::string templateTokenDescription(const TemplateToken& token) {
    switch (token.kind) {
    case TokenKind::TemplateData: return "template-data";
    case TokenKind::VariableStart: return "start of variable block";
    case TokenKind::VariableEnd: return "end of variable block";
    case TokenKind::BlockStart: return "start of block";
    case TokenKind::BlockEnd: return "end of block";
    case TokenKind::Identifier: return "identifier";
    case TokenKind::String: return "string";
    case TokenKind::Integer:
    case TokenKind::LargeInteger: return "integer";
    case TokenKind::Float: return "float";
    case TokenKind::Plus: return "`+`";
    case TokenKind::Minus: return "`-`";
    case TokenKind::Multiply: return "`*`";
    case TokenKind::Divide: return "`/`";
    case TokenKind::FloorDivide: return "`//`";
    case TokenKind::Power: return "`**`";
    case TokenKind::Modulo: return "`%`";
    case TokenKind::Dot: return "`.`";
    case TokenKind::Comma: return "`,`";
    case TokenKind::Colon: return "`:`";
    case TokenKind::Tilde: return "`~`";
    case TokenKind::Assign: return "`=`";
    case TokenKind::Pipe: return "`|`";
    case TokenKind::Equal: return "`==`";
    case TokenKind::NotEqual: return "`!=`";
    case TokenKind::Greater: return "`>`";
    case TokenKind::GreaterEqual: return "`>=`";
    case TokenKind::Less: return "`<`";
    case TokenKind::LessEqual: return "`<=`";
    case TokenKind::BracketOpen: return "`[`";
    case TokenKind::BracketClose: return "`]`";
    case TokenKind::ParenOpen: return "`(`";
    case TokenKind::ParenClose: return "`)`";
    case TokenKind::BraceOpen: return "`{`";
    case TokenKind::BraceClose: return "`}`";
    }
    return "token";
}

TemplateLexer::TemplateLexer(std::string_view source, std::string_view filename, bool inExpression, WhitespaceConfiguration whitespace)
    : source_(source), filename_(filename), whitespace_(whitespace) {
    if (!whitespace_.keepTrailingNewline) {
        if (source_.ends_with('\n')) source_.remove_suffix(1);
        if (source_.ends_with('\r')) source_.remove_suffix(1);
    }
    stack_.push_back(inExpression ? LexerState::Variable : LexerState::Template);
}

std::optional<SpannedToken> TemplateLexer::next() {
    for (;;) {
        if (rest().empty()) return std::nullopt;
        std::optional<SpannedToken> outcome;
        switch (stack_.back()) {
        case LexerState::Template: outcome = tokenizeRoot(); break;
        case LexerState::Block: outcome = tokenizeBlockOrVariable(Sentinel::Block); break;
        case LexerState::Variable: outcome = tokenizeBlockOrVariable(Sentinel::Variable); break;
        }
        if (outcome) return outcome;
    }
}

std::string_view TemplateLexer::rest() const noexcept {
    return source_.substr(currentOffset_);
}

std::string_view TemplateLexer::advance(std::size_t bytes) {
    const std::string_view skipped = rest().substr(0, bytes);
    for (std::size_t offset = 0; offset < skipped.size();) {
        const unicode::Utf8CodePoint decoded = unicode::decodeCodePointAt(skipped, offset);
        if (decoded.codePoint == U'\n') {
            if (currentLine_ != UINT16_MAX) ++currentLine_;
            currentColumn_ = 0;
        }
        else if (currentColumn_ != UINT16_MAX) {
            ++currentColumn_;
        }
        offset += decoded.byteLength;
    }
    currentOffset_ += bytes;
    return skipped;
}

TemplateLexer::Location TemplateLexer::location() const noexcept {
    return {currentLine_, currentColumn_, static_cast<std::uint32_t>(currentOffset_)};
}

TemplateSpan TemplateLexer::span(Location start) const noexcept {
    return {start.line, start.column, start.offset, currentLine_, currentColumn_, static_cast<std::uint32_t>(currentOffset_)};
}

TemplateError TemplateLexer::syntaxError(std::string message) const {
    TemplateSpan errorSpan = span(location());
    if (errorSpan.startColumn == errorSpan.endColumn) {
        ++errorSpan.endColumn;
        ++errorSpan.endOffset;
    }
    TemplateError error(TemplateErrorKind::SyntaxError, std::move(message));
    error.setFilenameAndSpan(filename_, errorSpan);
    return error;
}

void TemplateLexer::skipWhitespace() {
    const std::string_view remaining = rest();
    std::size_t skipped = 0;
    while (skipped < remaining.size()) {
        const unicode::Utf8CodePoint decoded = unicode::decodeCodePointAt(remaining, skipped);
        if (!unicode::isWhitespace(decoded.codePoint)) break;
        skipped += decoded.byteLength;
    }
    if (skipped > 0) advance(skipped);
}

void TemplateLexer::skipNewlineIfTrimBlocks() {
    if (!whitespace_.trimBlocks) return;
    if (rest().starts_with('\r')) advance(1);
    if (rest().starts_with('\n')) advance(1);
}

void TemplateLexer::handleTailWhitespace(Whitespace whitespace) {
    switch (whitespace) {
    case Whitespace::Preserve: break;
    case Whitespace::Default: skipNewlineIfTrimBlocks(); break;
    case Whitespace::Remove: trimLeadingWhitespace_ = true; break;
    }
}

std::optional<SpannedToken> TemplateLexer::tokenizeRoot() {
    if (pendingStartMarker_) {
        const PendingMarker pending = *pendingStartMarker_;
        pendingStartMarker_.reset();
        return handleStartMarker(pending.marker, pending.length);
    }
    if (trimLeadingWhitespace_) {
        trimLeadingWhitespace_ = false;
        skipWhitespace();
    }
    const Location start = location();
    std::string_view lead;
    TemplateSpan leadSpan;
    const auto found = findStartMarker(rest());
    if (found) {
        const auto marker = static_cast<StartMarker>(found->marker);
        pendingStartMarker_ = PendingMarker{marker, found->length};
        const auto whitespace = found->whitespace == 2 ? Whitespace::Remove : found->whitespace == 1 ? Whitespace::Preserve : Whitespace::Default;
        const std::string_view peeked = rest().substr(0, found->start);
        bool shouldLstrip = false;
        if (whitespace == Whitespace::Default && whitespace_.lstripBlocks && marker != StartMarker::Variable) {
            const std::string_view prefix = source_.substr(0, currentOffset_ + found->start);
            shouldLstrip = true;
            std::size_t end = prefix.size();
            while (end > 0) {
                const unicode::Utf8CodePoint decoded = unicode::decodeCodePointBefore(prefix, end);
                if (isNewline(decoded.codePoint)) break;
                if (!unicode::isWhitespace(decoded.codePoint)) {
                    shouldLstrip = false;
                    break;
                }
                end -= decoded.byteLength;
            }
        }
        if (whitespace == Whitespace::Default && shouldLstrip) {
            const std::string_view trimmed = lstripBlock(peeked);
            lead = advance(trimmed.size());
            leadSpan = span(start);
            static_cast<void>(advance(peeked.size() - trimmed.size()));
        }
        else if (whitespace == Whitespace::Remove) {
            const std::string_view trimmed = unicode::trimWhitespaceEnd(peeked);
            lead = advance(trimmed.size());
            leadSpan = span(start);
            static_cast<void>(advance(peeked.size() - trimmed.size()));
        }
        else {
            lead = advance(found->start);
            leadSpan = span(start);
        }
    }
    else {
        lead = advance(rest().size());
        leadSpan = span(start);
    }
    if (lead.empty()) return std::nullopt;
    return SpannedToken{TemplateToken{TokenKind::TemplateData, std::string(lead)}, leadSpan};
}

std::optional<SpannedToken> TemplateLexer::handleStartMarker(StartMarker marker, std::size_t skip) {
    switch (marker) {
    case StartMarker::Comment: {
        const std::size_t end = rest().substr(skip).find(kCommentEnd);
        if (end != std::string_view::npos) {
            const std::size_t probe = (end == 0 ? 0 : end - 1) + skip;
            const char probeByte = probe < rest().size() ? rest()[probe] : '\0';
            const Whitespace whitespace = probeByte == '-' ? Whitespace::Remove : probeByte == '+' ? Whitespace::Preserve : Whitespace::Default;
            static_cast<void>(advance(end + skip + kCommentEnd.size()));
            handleTailWhitespace(whitespace);
            return std::nullopt;
        }
        static_cast<void>(advance(rest().size()));
        throw syntaxError("unexpected end of comment");
    }
    case StartMarker::Variable: {
        const Location start = location();
        static_cast<void>(advance(skip));
        stack_.push_back(LexerState::Variable);
        return SpannedToken{TemplateToken{TokenKind::VariableStart, {}}, span(start)};
    }
    case StartMarker::Block: {
        if (const auto raw = skipBasicTag(rest().substr(skip), "raw", kBlockEnd, false)) {
            static_cast<void>(advance(raw->length + skip));
            const Whitespace whitespace = raw->whitespace == 2 ? Whitespace::Remove : raw->whitespace == 1 ? Whitespace::Preserve : Whitespace::Default;
            return handleRawTag(whitespace);
        }
        const Location start = location();
        static_cast<void>(advance(skip));
        stack_.push_back(LexerState::Block);
        return SpannedToken{TemplateToken{TokenKind::BlockStart, {}}, span(start)};
    }
    }
    return std::nullopt;
}

std::optional<SpannedToken> TemplateLexer::handleRawTag(Whitespace startWhitespace) {
    const Location start = location();
    std::size_t pointer = 0;
    for (;;) {
        const std::size_t block = rest().substr(pointer).find(kBlockStart);
        if (block == std::string_view::npos) break;
        pointer += block + kBlockStart.size();
        const auto endRaw = skipBasicTag(rest().substr(pointer), "endraw", kBlockEnd, true);
        if (!endRaw) continue;
        const char whitespaceByte = pointer < rest().size() ? rest()[pointer] : '\0';
        const Whitespace whitespace = whitespaceByte == '-' ? Whitespace::Remove : whitespaceByte == '+' ? Whitespace::Preserve : Whitespace::Default;
        const std::size_t end = pointer - kBlockStart.size();
        std::string_view result = advance(end);
        const TemplateSpan resultSpan = span(start);
        static_cast<void>(advance(kBlockStart.size() + endRaw->length));
        if (startWhitespace == Whitespace::Default && whitespace_.trimBlocks) {
            if (result.starts_with('\r')) result.remove_prefix(1);
            if (result.starts_with('\n')) result.remove_prefix(1);
        }
        else if (startWhitespace == Whitespace::Remove) {
            result = unicode::trimWhitespaceStart(result);
        }
        if (whitespace == Whitespace::Default && whitespace_.lstripBlocks) result = lstripBlock(result);
        else if (whitespace == Whitespace::Remove) result = unicode::trimWhitespaceEnd(result);
        const Whitespace nextWhitespace = endRaw->whitespace == 2 ? Whitespace::Remove : endRaw->whitespace == 1 ? Whitespace::Preserve : Whitespace::Default;
        handleTailWhitespace(nextWhitespace);
        return SpannedToken{TemplateToken{TokenKind::TemplateData, std::string(result)}, resultSpan};
    }
    static_cast<void>(advance(rest().size()));
    throw syntaxError("unexpected end of raw block");
}

std::optional<SpannedToken> TemplateLexer::tokenizeBlockOrVariable(Sentinel sentinel) {
    const Location start = location();
    const std::string_view remaining = rest();
    const auto nonWhitespace = std::ranges::find_if(remaining, [](char byte) { return !isAsciiWhitespaceByte(byte); });
    if (nonWhitespace == remaining.end()) {
        static_cast<void>(advance(remaining.size()));
        return std::nullopt;
    }
    if (nonWhitespace != remaining.begin()) {
        static_cast<void>(advance(static_cast<std::size_t>(nonWhitespace - remaining.begin())));
        return std::nullopt;
    }
    const auto withToken = [this, start](TokenKind kind, std::size_t length) {
        static_cast<void>(advance(length));
        return SpannedToken{TemplateToken{kind, {}}, span(start)};
    };
    if (parenBalance_ == 0) {
        const bool controlPrefix = remaining.starts_with('-') || remaining.starts_with('+');
        if (sentinel == Sentinel::Block) {
            if (controlPrefix && remaining.substr(1).starts_with(kBlockEnd)) {
                stack_.pop_back();
                const bool wasMinus = remaining.front() == '-';
                auto token = withToken(TokenKind::BlockEnd, kBlockEnd.size() + 1);
                if (wasMinus) trimLeadingWhitespace_ = true;
                return token;
            }
            if (remaining.starts_with(kBlockEnd)) {
                stack_.pop_back();
                auto token = withToken(TokenKind::BlockEnd, kBlockEnd.size());
                skipNewlineIfTrimBlocks();
                return token;
            }
        }
        else {
            if (controlPrefix && remaining.substr(1).starts_with(kVariableEnd)) {
                stack_.pop_back();
                const bool wasMinus = remaining.front() == '-';
                auto token = withToken(TokenKind::VariableEnd, kVariableEnd.size() + 1);
                if (wasMinus) trimLeadingWhitespace_ = true;
                return token;
            }
            if (remaining.starts_with(kVariableEnd)) {
                stack_.pop_back();
                return withToken(TokenKind::VariableEnd, kVariableEnd.size());
            }
        }
    }
    const std::string_view twoCharacters = remaining.substr(0, 2);
    if (twoCharacters == "//") return withToken(TokenKind::FloorDivide, 2);
    if (twoCharacters == "**") return withToken(TokenKind::Power, 2);
    if (twoCharacters == "==") return withToken(TokenKind::Equal, 2);
    if (twoCharacters == "!=") return withToken(TokenKind::NotEqual, 2);
    if (twoCharacters == ">=") return withToken(TokenKind::GreaterEqual, 2);
    if (twoCharacters == "<=") return withToken(TokenKind::LessEqual, 2);
    switch (remaining.front()) {
    case '+': return withToken(TokenKind::Plus, 1);
    case '-': return withToken(TokenKind::Minus, 1);
    case '*': return withToken(TokenKind::Multiply, 1);
    case '/': return withToken(TokenKind::Divide, 1);
    case '%': return withToken(TokenKind::Modulo, 1);
    case '.': return withToken(TokenKind::Dot, 1);
    case ',': return withToken(TokenKind::Comma, 1);
    case ':': return withToken(TokenKind::Colon, 1);
    case '~': return withToken(TokenKind::Tilde, 1);
    case '|': return withToken(TokenKind::Pipe, 1);
    case '=': return withToken(TokenKind::Assign, 1);
    case '>': return withToken(TokenKind::Greater, 1);
    case '<': return withToken(TokenKind::Less, 1);
    case '(': ++parenBalance_; return withToken(TokenKind::ParenOpen, 1);
    case ')': --parenBalance_; return withToken(TokenKind::ParenClose, 1);
    case '[': ++parenBalance_; return withToken(TokenKind::BracketOpen, 1);
    case ']': --parenBalance_; return withToken(TokenKind::BracketClose, 1);
    case '{': ++parenBalance_; return withToken(TokenKind::BraceOpen, 1);
    case '}': --parenBalance_; return withToken(TokenKind::BraceClose, 1);
    case '\'': return eatString('\'');
    case '"': return eatString('"');
    default: break;
    }
    if (remaining.front() >= '0' && remaining.front() <= '9') return eatNumber();
    return eatIdentifier();
}

SpannedToken TemplateLexer::eatNumber() {
    enum class NumberState { RadixInteger, Integer, Fraction, Exponent, ExponentSign };
    const Location start = location();
    unsigned radix = 10;
    const std::string_view prefix = rest().substr(0, 2);
    if (prefix == "0b" || prefix == "0B") radix = 2;
    else if (prefix == "0o" || prefix == "0O") radix = 8;
    else if (prefix == "0x" || prefix == "0X") radix = 16;
    NumberState state = NumberState::Integer;
    if (radix != 10) {
        static_cast<void>(advance(2));
        state = NumberState::RadixInteger;
    }
    const std::string_view digits = rest();
    std::size_t length = static_cast<std::size_t>(std::ranges::find_if(digits, [](char byte) { return byte < '0' || byte > '9'; }) - digits.begin());
    bool hasUnderscore = false;
    for (std::size_t index = length; index < digits.size(); ++index) {
        const char byte = digits[index];
        if (byte == '.' && state == NumberState::Integer) state = NumberState::Fraction;
        else if ((byte == 'E' || byte == 'e') && (state == NumberState::Integer || state == NumberState::Fraction)) state = NumberState::Exponent;
        else if ((byte == '+' || byte == '-') && state == NumberState::Exponent) state = NumberState::ExponentSign;
        else if (byte >= '0' && byte <= '9' && state == NumberState::Exponent) state = NumberState::ExponentSign;
        else if (byte >= '0' && byte <= '9') {
        }
        else if (((byte >= 'a' && byte <= 'f') || (byte >= 'A' && byte <= 'F')) && state == NumberState::RadixInteger && radix == 16) {
        }
        else if (byte == '_') hasUnderscore = true;
        else break;
        ++length;
    }
    const bool isFloat = state != NumberState::Integer && state != NumberState::RadixInteger;
    std::string number(advance(length));
    if (hasUnderscore) {
        if (number.ends_with('_')) throw syntaxError("'_' may not occur at end of number");
        std::erase(number, '_');
    }
    TemplateToken token;
    if (isFloat) {
        double value = 0.0;
        const auto result = std::from_chars(number.data(), number.data() + number.size(), value, std::chars_format::general);
        if (result.ec != std::errc{} || result.ptr != number.data() + number.size()) throw syntaxError("invalid float");
        token.kind = TokenKind::Float;
        token.floating = value;
    }
    else {
        const auto value = numeric::parseUInt128(number, radix);
        if (value && value->fitsUInt64()) {
            token.kind = TokenKind::Integer;
            token.integer = value->low();
        }
        else if (value) {
            token.kind = TokenKind::LargeInteger;
            token.largeInteger = *value;
        }
        else {
            throw syntaxError("invalid integer (too large)");
        }
    }
    return SpannedToken{std::move(token), span(start)};
}

SpannedToken TemplateLexer::eatIdentifier() {
    const std::string_view remaining = rest();
    std::size_t length = 0;
    while (length < remaining.size()) {
        const char byte = remaining[length];
        const bool alphabetic = (byte >= 'a' && byte <= 'z') || (byte >= 'A' && byte <= 'Z');
        const bool numericByte = byte >= '0' && byte <= '9';
        if (!(byte == '_' || (length == 0 ? alphabetic : alphabetic || numericByte))) break;
        ++length;
    }
    if (length == 0) throw syntaxError("unexpected character");
    const Location start = location();
    std::string identifier(advance(length));
    return SpannedToken{TemplateToken{TokenKind::Identifier, std::move(identifier)}, span(start)};
}

SpannedToken TemplateLexer::eatString(char delimiter) {
    const Location start = location();
    const std::string_view remaining = rest();
    bool escaped = false;
    bool hasEscapes = false;
    std::size_t length = 0;
    for (std::size_t index = 1; index < remaining.size(); ++index) {
        const char byte = remaining[index];
        if (escaped) {
            escaped = false;
        }
        else if (byte == '\\') {
            escaped = true;
            hasEscapes = true;
        }
        else if (byte == delimiter) {
            break;
        }
        ++length;
    }
    if (escaped || length + 1 >= remaining.size() || remaining[length + 1] != delimiter) {
        static_cast<void>(advance(std::min(length + 1, remaining.size())));
        throw syntaxError("unexpected end of string");
    }
    const std::string_view quoted = advance(length + 2);
    const std::string_view inner = quoted.substr(1, quoted.size() - 2);
    TemplateToken token{TokenKind::String, hasEscapes ? unescapeTemplateString(inner) : std::string(inner)};
    return SpannedToken{std::move(token), span(start)};
}

}
