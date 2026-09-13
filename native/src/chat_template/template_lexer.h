#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "chat_template/template_error.h"
#include "numeric/int128.h"

namespace eversoul::native::chat_template {

enum class TokenKind {
    TemplateData,
    VariableStart,
    VariableEnd,
    BlockStart,
    BlockEnd,
    Identifier,
    String,
    Integer,
    LargeInteger,
    Float,
    Plus,
    Minus,
    Multiply,
    Divide,
    FloorDivide,
    Power,
    Modulo,
    Dot,
    Comma,
    Colon,
    Tilde,
    Assign,
    Pipe,
    Equal,
    NotEqual,
    Greater,
    GreaterEqual,
    Less,
    LessEqual,
    BracketOpen,
    BracketClose,
    ParenOpen,
    ParenClose,
    BraceOpen,
    BraceClose,
};

struct TemplateToken {
    TokenKind kind = TokenKind::TemplateData;
    std::string text;
    std::uint64_t integer = 0;
    numeric::UInt128 largeInteger;
    double floating = 0.0;
};

[[nodiscard]] std::string templateTokenDescription(const TemplateToken& token);

struct SpannedToken {
    TemplateToken token;
    TemplateSpan span;
};

struct WhitespaceConfiguration {
    bool keepTrailingNewline = false;
    bool lstripBlocks = false;
    bool trimBlocks = false;
};

class TemplateLexer {
public:
    TemplateLexer(std::string_view source, std::string_view filename, bool inExpression, WhitespaceConfiguration whitespace);

    [[nodiscard]] std::optional<SpannedToken> next();
    [[nodiscard]] std::string_view filename() const noexcept { return filename_; }

private:
    enum class LexerState { Template, Variable, Block };
    enum class StartMarker { Variable, Block, Comment };
    enum class Whitespace { Default, Preserve, Remove };
    enum class Sentinel { Variable, Block };

    struct PendingMarker {
        StartMarker marker;
        std::size_t length;
    };

    struct Location {
        std::uint16_t line;
        std::uint16_t column;
        std::uint32_t offset;
    };

    [[nodiscard]] std::string_view rest() const noexcept;
    std::string_view advance(std::size_t bytes);
    [[nodiscard]] Location location() const noexcept;
    [[nodiscard]] TemplateSpan span(Location start) const noexcept;
    [[nodiscard]] TemplateError syntaxError(std::string message) const;

    [[nodiscard]] std::optional<SpannedToken> tokenizeRoot();
    [[nodiscard]] std::optional<SpannedToken> handleStartMarker(StartMarker marker, std::size_t skip);
    [[nodiscard]] std::optional<SpannedToken> handleRawTag(Whitespace startWhitespace);
    [[nodiscard]] std::optional<SpannedToken> tokenizeBlockOrVariable(Sentinel sentinel);
    [[nodiscard]] SpannedToken eatNumber();
    [[nodiscard]] SpannedToken eatIdentifier();
    [[nodiscard]] SpannedToken eatString(char delimiter);
    void skipWhitespace();
    void skipNewlineIfTrimBlocks();
    void handleTailWhitespace(Whitespace whitespace);

    std::string_view source_;
    std::string filename_;
    std::vector<LexerState> stack_;
    std::uint16_t currentLine_ = 1;
    std::uint16_t currentColumn_ = 0;
    std::size_t currentOffset_ = 0;
    bool trimLeadingWhitespace_ = false;
    std::optional<PendingMarker> pendingStartMarker_;
    std::ptrdiff_t parenBalance_ = 0;
    WhitespaceConfiguration whitespace_;
};

[[nodiscard]] std::string unescapeTemplateString(std::string_view text);

}
