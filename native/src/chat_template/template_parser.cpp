#include "chat_template/template_parser.h"

#include <algorithm>
#include <array>
#include <cstddef>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <variant>
#include <vector>

#include "chat_template/template_ast.h"
#include "chat_template/template_error.h"
#include "chat_template/template_lexer.h"
#include "chat_template/template_operations.h"
#include "chat_template/template_value.h"

namespace eversoul::native::chat_template {
namespace {

constexpr std::size_t kMaximumRecursion = 150;
constexpr std::array<std::string_view, 8> kReservedNames{"true", "True", "false", "False", "none", "None", "loop", "self"};

TemplateError syntaxError(std::string message) {
    return TemplateError(TemplateErrorKind::SyntaxError, std::move(message));
}

TemplateError unexpected(std::string_view found, std::string_view expected) {
    return syntaxError("unexpected " + std::string(found) + ", expected " + std::string(expected));
}

TemplateError unexpectedEnd(std::string_view expected) {
    return unexpected("end of input", expected);
}

ExpressionPointer makeExpression(auto node, TemplateSpan span) {
    auto expression = std::make_unique<Expression>();
    expression->node = std::move(node);
    expression->span = span;
    return expression;
}

Statement makeStatement(auto node, TemplateSpan span) {
    Statement statement;
    statement.node = std::move(node);
    statement.span = span;
    return statement;
}

class TokenStream {
public:
    TokenStream(std::string_view source, std::string_view filename, bool inExpression, WhitespaceConfiguration whitespace)
        : lexer_(source, filename, inExpression, whitespace) {
        pull();
    }

    std::optional<SpannedToken> next() {
        State taken = std::move(current_);
        pull();
        if (auto* error = std::get_if<TemplateError>(&taken)) throw std::move(*error);
        if (auto* token = std::get_if<SpannedToken>(&taken)) {
            lastSpan_ = token->span;
            return std::move(*token);
        }
        return std::nullopt;
    }

    const SpannedToken* current() {
        if (auto* token = std::get_if<SpannedToken>(&current_)) return token;
        if (auto* error = std::get_if<TemplateError>(&current_)) {
            TemplateError taken = std::move(*error);
            current_ = std::monostate{};
            throw taken;
        }
        return nullptr;
    }

    [[nodiscard]] TemplateSpan expandSpan(TemplateSpan span) const noexcept {
        span.endLine = lastSpan_.endLine;
        span.endColumn = lastSpan_.endColumn;
        span.endOffset = lastSpan_.endOffset;
        return span;
    }

    [[nodiscard]] TemplateSpan currentSpan() const noexcept {
        if (const auto* token = std::get_if<SpannedToken>(&current_)) return token->span;
        return lastSpan_;
    }

    [[nodiscard]] TemplateSpan lastSpan() const noexcept { return lastSpan_; }
    [[nodiscard]] std::string_view filename() const noexcept { return lexer_.filename(); }

private:
    using State = std::variant<std::monostate, SpannedToken, TemplateError>;

    void pull() {
        try {
            if (auto token = lexer_.next()) current_ = std::move(*token);
            else current_ = std::monostate{};
        }
        catch (TemplateError& error) {
            current_ = std::move(error);
        }
    }

    TemplateLexer lexer_;
    State current_;
    TemplateSpan lastSpan_;
};

bool isIdentifier(const SpannedToken* token, std::string_view name) noexcept {
    return token != nullptr && token->token.kind == TokenKind::Identifier && token->token.text == name;
}

bool isKind(const SpannedToken* token, TokenKind kind) noexcept {
    return token != nullptr && token->token.kind == kind;
}

class Parser {
public:
    Parser(std::string_view source, std::string_view filename, bool inExpression, WhitespaceConfiguration whitespace)
        : stream_(source, filename, inExpression, whitespace) {}

    Statement parse() {
        try {
            const TemplateSpan start = stream_.lastSpan();
            StatementList children = subparse([](const SpannedToken&) { return false; });
            return makeStatement(TemplateStatement{std::move(children)}, stream_.expandSpan(start));
        }
        catch (TemplateError& error) {
            attachLocation(error);
            throw;
        }
    }

    ExpressionPointer parseStandalone() {
        try {
            ExpressionPointer expression = parseExpression();
            if (stream_.next()) throw syntaxError("unexpected input after expression");
            return expression;
        }
        catch (TemplateError& error) {
            attachLocation(error);
            throw;
        }
    }

private:
    class RecursionGuard {
    public:
        explicit RecursionGuard(std::size_t& depth) : depth_(depth) {
            if (++depth_ > kMaximumRecursion) {
                --depth_;
                throw syntaxError("template exceeds maximum recursion limits");
            }
        }
        RecursionGuard(const RecursionGuard&) = delete;
        RecursionGuard& operator=(const RecursionGuard&) = delete;
        ~RecursionGuard() { --depth_; }

    private:
        std::size_t& depth_;
    };

    void attachLocation(TemplateError& error) {
        if (!error.line()) error.setFilenameAndSpan(stream_.filename(), stream_.lastSpan());
    }

    SpannedToken expectToken(std::string_view expectation) {
        auto token = stream_.next();
        if (!token) throw unexpectedEnd(expectation);
        return std::move(*token);
    }

    SpannedToken expectKind(TokenKind kind, std::string_view expectation) {
        auto token = stream_.next();
        if (!token) throw unexpectedEnd(expectation);
        if (token->token.kind != kind) throw unexpected(templateTokenDescription(token->token), expectation);
        return std::move(*token);
    }

    SpannedToken expectIdentifierNamed(std::string_view name, std::string_view expectation) {
        auto token = stream_.next();
        if (!token) throw unexpectedEnd(expectation);
        if (token->token.kind != TokenKind::Identifier || token->token.text != name) {
            throw unexpected(templateTokenDescription(token->token), expectation);
        }
        return std::move(*token);
    }

    bool matchesKind(TokenKind kind) { return isKind(stream_.current(), kind); }
    bool matchesIdentifier(std::string_view name) { return isIdentifier(stream_.current(), name); }

    bool skipKind(TokenKind kind) {
        if (!matchesKind(kind)) return false;
        static_cast<void>(stream_.next());
        return true;
    }

    bool skipIdentifier(std::string_view name) {
        if (!matchesIdentifier(name)) return false;
        static_cast<void>(stream_.next());
        return true;
    }

    ExpressionPointer parseExpression() {
        RecursionGuard guard(depth_);
        return parseConditional();
    }

    ExpressionPointer parseExpressionWithoutConditional() { return parseOr(); }

    ExpressionPointer parseConditional() {
        TemplateSpan span = stream_.lastSpan();
        ExpressionPointer expression = parseOr();
        while (skipIdentifier("if")) {
            ExpressionPointer test = parseOr();
            ExpressionPointer otherwise;
            if (skipIdentifier("else")) otherwise = parseConditional();
            expression = makeExpression(ConditionalExpression{std::move(test), std::move(expression), std::move(otherwise)}, stream_.expandSpan(span));
            span = stream_.lastSpan();
        }
        return expression;
    }

    ExpressionPointer parseBinary(const std::function<ExpressionPointer()>& nextLevel,
        const std::function<std::optional<BinaryOperatorKind>(const SpannedToken*)>& operatorFor) {
        const TemplateSpan span = stream_.currentSpan();
        ExpressionPointer left = nextLevel();
        for (;;) {
            const auto kind = operatorFor(stream_.current());
            if (!kind) break;
            static_cast<void>(stream_.next());
            ExpressionPointer right = nextLevel();
            left = makeExpression(BinaryExpression{*kind, std::move(left), std::move(right)}, stream_.expandSpan(span));
        }
        return left;
    }

    ExpressionPointer parseOr() {
        return parseBinary([this] { return parseAnd(); }, [](const SpannedToken* token) -> std::optional<BinaryOperatorKind> {
            if (isIdentifier(token, "or")) return BinaryOperatorKind::ShortCircuitOr;
            return std::nullopt;
        });
    }

    ExpressionPointer parseAnd() {
        return parseBinary([this] { return parseNot(); }, [](const SpannedToken* token) -> std::optional<BinaryOperatorKind> {
            if (isIdentifier(token, "and")) return BinaryOperatorKind::ShortCircuitAnd;
            return std::nullopt;
        });
    }

    ExpressionPointer parseNot() {
        const TemplateSpan span = stream_.currentSpan();
        if (!matchesIdentifier("not")) return parseCompare();
        static_cast<void>(stream_.next());
        ExpressionPointer operand = parseNot();
        return makeExpression(UnaryExpression{UnaryOperatorKind::Not, std::move(operand)}, stream_.expandSpan(span));
    }

    ExpressionPointer parseCompare() {
        TemplateSpan span = stream_.lastSpan();
        ExpressionPointer expression = parseMath1();
        for (;;) {
            bool negated = false;
            const SpannedToken* token = stream_.current();
            BinaryOperatorKind kind{};
            if (isKind(token, TokenKind::Equal)) kind = BinaryOperatorKind::Equal;
            else if (isKind(token, TokenKind::NotEqual)) kind = BinaryOperatorKind::NotEqual;
            else if (isKind(token, TokenKind::Less)) kind = BinaryOperatorKind::Less;
            else if (isKind(token, TokenKind::LessEqual)) kind = BinaryOperatorKind::LessEqual;
            else if (isKind(token, TokenKind::Greater)) kind = BinaryOperatorKind::Greater;
            else if (isKind(token, TokenKind::GreaterEqual)) kind = BinaryOperatorKind::GreaterEqual;
            else if (isIdentifier(token, "in")) kind = BinaryOperatorKind::In;
            else if (isIdentifier(token, "not")) {
                static_cast<void>(stream_.next());
                static_cast<void>(expectIdentifierNamed("in", "in"));
                negated = true;
                kind = BinaryOperatorKind::In;
            }
            else {
                break;
            }
            if (!negated) static_cast<void>(stream_.next());
            ExpressionPointer right = parseMath1();
            expression = makeExpression(BinaryExpression{kind, std::move(expression), std::move(right)}, stream_.expandSpan(span));
            if (negated) {
                expression = makeExpression(UnaryExpression{UnaryOperatorKind::Not, std::move(expression)}, stream_.expandSpan(span));
            }
            span = stream_.lastSpan();
        }
        return expression;
    }

    ExpressionPointer parseMath1() {
        return parseBinary([this] { return parseConcat(); }, [](const SpannedToken* token) -> std::optional<BinaryOperatorKind> {
            if (isKind(token, TokenKind::Plus)) return BinaryOperatorKind::Add;
            if (isKind(token, TokenKind::Minus)) return BinaryOperatorKind::Subtract;
            return std::nullopt;
        });
    }

    ExpressionPointer parseConcat() {
        return parseBinary([this] { return parseMath2(); }, [](const SpannedToken* token) -> std::optional<BinaryOperatorKind> {
            if (isKind(token, TokenKind::Tilde)) return BinaryOperatorKind::Concatenate;
            return std::nullopt;
        });
    }

    ExpressionPointer parseMath2() {
        return parseBinary([this] { return parsePower(); }, [](const SpannedToken* token) -> std::optional<BinaryOperatorKind> {
            if (isKind(token, TokenKind::Multiply)) return BinaryOperatorKind::Multiply;
            if (isKind(token, TokenKind::Divide)) return BinaryOperatorKind::Divide;
            if (isKind(token, TokenKind::FloorDivide)) return BinaryOperatorKind::FloorDivide;
            if (isKind(token, TokenKind::Modulo)) return BinaryOperatorKind::Remainder;
            return std::nullopt;
        });
    }

    ExpressionPointer parsePower() {
        return parseBinary([this] { return parseUnary(); }, [](const SpannedToken* token) -> std::optional<BinaryOperatorKind> {
            if (isKind(token, TokenKind::Power)) return BinaryOperatorKind::Power;
            return std::nullopt;
        });
    }

    ExpressionPointer parseUnaryOnly() {
        const TemplateSpan span = stream_.currentSpan();
        if (!matchesKind(TokenKind::Minus)) return parsePrimary();
        static_cast<void>(stream_.next());
        ExpressionPointer operand = parseUnaryOnly();
        return makeExpression(UnaryExpression{UnaryOperatorKind::Negate, std::move(operand)}, stream_.expandSpan(span));
    }

    ExpressionPointer parseUnary() {
        const TemplateSpan span = stream_.currentSpan();
        ExpressionPointer expression = parseUnaryOnly();
        expression = parsePostfix(std::move(expression), span);
        return parseFilterExpression(std::move(expression));
    }

    ExpressionPointer parsePostfix(ExpressionPointer expression, TemplateSpan span) {
        for (;;) {
            const TemplateSpan nextSpan = stream_.currentSpan();
            if (matchesKind(TokenKind::Dot)) {
                static_cast<void>(stream_.next());
                SpannedToken name = expectKind(TokenKind::Identifier, "identifier");
                expression = makeExpression(AttributeExpression{std::move(expression), std::move(name.token.text)}, stream_.expandSpan(span));
            }
            else if (matchesKind(TokenKind::BracketOpen)) {
                static_cast<void>(stream_.next());
                ExpressionPointer start;
                ExpressionPointer stop;
                ExpressionPointer step;
                bool isSlice = false;
                if (!matchesKind(TokenKind::Colon)) start = parseExpression();
                if (skipKind(TokenKind::Colon)) {
                    isSlice = true;
                    if (!matchesKind(TokenKind::BracketClose) && !matchesKind(TokenKind::Colon)) stop = parseExpression();
                    if (skipKind(TokenKind::Colon) && !matchesKind(TokenKind::BracketClose)) step = parseExpression();
                }
                static_cast<void>(expectKind(TokenKind::BracketClose, "`]`"));
                if (!isSlice) {
                    if (!start) throw syntaxError("empty subscript");
                    expression = makeExpression(ItemExpression{std::move(expression), std::move(start)}, stream_.expandSpan(span));
                }
                else {
                    expression = makeExpression(SliceExpression{std::move(expression), std::move(start), std::move(stop), std::move(step)},
                        stream_.expandSpan(span));
                }
            }
            else if (matchesKind(TokenKind::ParenOpen)) {
                std::vector<CallArgument> arguments = parseArguments();
                expression = makeExpression(CallExpression{std::move(expression), std::move(arguments)}, stream_.expandSpan(span));
            }
            else {
                break;
            }
            span = nextSpan;
        }
        return expression;
    }

    ExpressionPointer parseFilterExpression(ExpressionPointer expression) {
        for (;;) {
            if (matchesKind(TokenKind::Pipe)) {
                static_cast<void>(stream_.next());
                SpannedToken name = expectKind(TokenKind::Identifier, "identifier");
                std::vector<CallArgument> arguments;
                if (matchesKind(TokenKind::ParenOpen)) arguments = parseArguments();
                expression = makeExpression(FilterExpression{std::move(name.token.text), std::move(expression), std::move(arguments)},
                    stream_.expandSpan(name.span));
            }
            else if (matchesIdentifier("is")) {
                static_cast<void>(stream_.next());
                const bool negated = skipIdentifier("not");
                SpannedToken name = expectKind(TokenKind::Identifier, "identifier");
                std::vector<CallArgument> arguments;
                if (matchesKind(TokenKind::ParenOpen)) {
                    arguments = parseArguments();
                }
                else {
                    const SpannedToken* token = stream_.current();
                    const bool argumentStart = isKind(token, TokenKind::Identifier) || isKind(token, TokenKind::String)
                        || isKind(token, TokenKind::Integer) || isKind(token, TokenKind::LargeInteger) || isKind(token, TokenKind::Float)
                        || isKind(token, TokenKind::Plus) || isKind(token, TokenKind::Minus) || isKind(token, TokenKind::BracketOpen)
                        || isKind(token, TokenKind::BraceOpen);
                    const bool keyword = isIdentifier(token, "and") || isIdentifier(token, "or") || isIdentifier(token, "else")
                        || isIdentifier(token, "is");
                    if (argumentStart && !keyword) {
                        const TemplateSpan argumentSpan = stream_.currentSpan();
                        ExpressionPointer argument = parseUnaryOnly();
                        argument = parsePostfix(std::move(argument), argumentSpan);
                        arguments.push_back(CallArgument{CallArgumentKind::Positional, {}, std::move(argument)});
                    }
                }
                expression = makeExpression(TestExpression{std::move(name.token.text), std::move(expression), std::move(arguments)},
                    stream_.expandSpan(name.span));
                if (negated) {
                    expression = makeExpression(UnaryExpression{UnaryOperatorKind::Not, std::move(expression)}, stream_.expandSpan(name.span));
                }
            }
            else {
                break;
            }
        }
        return expression;
    }

    std::vector<CallArgument> parseArguments() {
        std::vector<CallArgument> arguments;
        bool hasKeywords = false;
        static_cast<void>(expectKind(TokenKind::ParenOpen, "`(`"));
        for (;;) {
            if (skipKind(TokenKind::ParenClose)) break;
            if (!arguments.empty() || hasKeywords) {
                static_cast<void>(expectKind(TokenKind::Comma, "`,`"));
                if (skipKind(TokenKind::ParenClose)) break;
            }
            enum class ArgumentType { Regular, Splat, KeywordSplat };
            ArgumentType type = ArgumentType::Regular;
            if (skipKind(TokenKind::Power)) type = ArgumentType::KeywordSplat;
            else if (skipKind(TokenKind::Multiply)) type = ArgumentType::Splat;
            ExpressionPointer expression = parseExpression();
            switch (type) {
            case ArgumentType::Regular: {
                const auto* variable = std::get_if<VariableExpression>(&expression->node);
                if (variable != nullptr && skipKind(TokenKind::Assign)) {
                    hasKeywords = true;
                    std::string name = variable->identifier;
                    arguments.push_back(CallArgument{CallArgumentKind::Keyword, std::move(name), parseExpressionWithoutConditional()});
                }
                else if (hasKeywords) {
                    throw syntaxError("non-keyword arg after keyword arg");
                }
                else {
                    arguments.push_back(CallArgument{CallArgumentKind::Positional, {}, std::move(expression)});
                }
                break;
            }
            case ArgumentType::Splat:
                arguments.push_back(CallArgument{CallArgumentKind::PositionalSplat, {}, std::move(expression)});
                break;
            case ArgumentType::KeywordSplat:
                arguments.push_back(CallArgument{CallArgumentKind::KeywordSplat, {}, std::move(expression)});
                hasKeywords = true;
                break;
            }
            if (arguments.size() > 2000) throw syntaxError("Too many arguments in function call");
        }
        return arguments;
    }

    ExpressionPointer parsePrimary() {
        RecursionGuard guard(depth_);
        return parsePrimaryImplementation();
    }

    ExpressionPointer parsePrimaryImplementation() {
        SpannedToken token = expectToken("expression");
        const auto constant = [this, &token](Value value) {
            return makeExpression(ConstantExpression{std::move(value)}, stream_.expandSpan(token.span));
        };
        switch (token.token.kind) {
        case TokenKind::Identifier: {
            const std::string& name = token.token.text;
            if (name == "true" || name == "True") return constant(Value::fromBool(true));
            if (name == "false" || name == "False") return constant(Value::fromBool(false));
            if (name == "none" || name == "None") return constant(Value::none());
            return makeExpression(VariableExpression{name}, token.span);
        }
        case TokenKind::String: {
            std::string buffer = std::move(token.token.text);
            while (matchesKind(TokenKind::String)) {
                buffer.append(stream_.current()->token.text);
                static_cast<void>(stream_.next());
            }
            return constant(Value::fromString(buffer));
        }
        case TokenKind::Integer: return constant(Value::fromUInt64(token.token.integer));
        case TokenKind::LargeInteger: return constant(Value::fromUInt128(token.token.largeInteger));
        case TokenKind::Float: return constant(Value::fromDouble(token.token.floating));
        case TokenKind::ParenOpen: return parseTupleOrExpression(token.span);
        case TokenKind::BracketOpen: return parseListExpression(token.span);
        case TokenKind::BraceOpen: return parseMapExpression(token.span);
        default: break;
        }
        throw syntaxError("unexpected " + templateTokenDescription(token.token));
    }

    ExpressionPointer parseListExpression(TemplateSpan span) {
        std::vector<ExpressionPointer> items;
        for (;;) {
            if (skipKind(TokenKind::BracketClose)) break;
            if (!items.empty()) {
                static_cast<void>(expectKind(TokenKind::Comma, "`,`"));
                if (skipKind(TokenKind::BracketClose)) break;
            }
            items.push_back(parseExpression());
        }
        return makeExpression(ListExpression{std::move(items)}, stream_.expandSpan(span));
    }

    ExpressionPointer parseMapExpression(TemplateSpan span) {
        std::vector<ExpressionPointer> keys;
        std::vector<ExpressionPointer> values;
        for (;;) {
            if (skipKind(TokenKind::BraceClose)) break;
            if (!keys.empty()) {
                static_cast<void>(expectKind(TokenKind::Comma, "`,`"));
                if (skipKind(TokenKind::BraceClose)) break;
            }
            keys.push_back(parseExpression());
            static_cast<void>(expectKind(TokenKind::Colon, "`:`"));
            values.push_back(parseExpression());
        }
        return makeExpression(MapExpression{std::move(keys), std::move(values)}, stream_.expandSpan(span));
    }

    ExpressionPointer parseTupleOrExpression(TemplateSpan span) {
        if (skipKind(TokenKind::ParenClose)) return makeExpression(ListExpression{}, stream_.expandSpan(span));
        ExpressionPointer expression = parseExpression();
        if (matchesKind(TokenKind::Comma)) {
            std::vector<ExpressionPointer> items;
            items.push_back(std::move(expression));
            for (;;) {
                if (skipKind(TokenKind::ParenClose)) break;
                static_cast<void>(expectKind(TokenKind::Comma, "`,`"));
                if (skipKind(TokenKind::ParenClose)) break;
                items.push_back(parseExpression());
            }
            return makeExpression(ListExpression{std::move(items)}, stream_.expandSpan(span));
        }
        static_cast<void>(expectKind(TokenKind::ParenClose, "`)`"));
        return expression;
    }

    Statement parseStatement() {
        RecursionGuard guard(depth_);
        return parseStatementUnprotected();
    }

    Statement parseStatementUnprotected() {
        SpannedToken token = expectToken("block keyword");
        if (token.token.kind != TokenKind::Identifier) throw syntaxError("unknown " + templateTokenDescription(token.token) + ", expected statement");
        const std::string& keyword = token.token.text;
        const TemplateSpan start = token.span;
        const auto respan = [this, start](auto node) { return makeStatement(std::move(node), stream_.expandSpan(start)); };
        if (keyword == "for") return respan(parseForStatement());
        if (keyword == "if") return respan(parseIfCondition());
        if (keyword == "with") return respan(parseWithBlock());
        if (keyword == "set") {
            auto result = parseSet();
            if (auto* set = std::get_if<SetStatement>(&result)) return respan(std::move(*set));
            return respan(std::move(std::get<SetBlockStatement>(result)));
        }
        if (keyword == "autoescape") return respan(parseAutoEscape());
        if (keyword == "filter") return respan(parseFilterBlock());
        if (keyword == "block") return respan(parseBlock());
        if (keyword == "extends") return respan(ExtendsStatement{parseExpression()});
        if (keyword == "include") return respan(parseInclude());
        if (keyword == "import") return respan(parseImport());
        if (keyword == "from") return respan(parseFromImport());
        if (keyword == "macro") return respan(parseMacro());
        if (keyword == "call") return respan(parseCallBlock());
        if (keyword == "do") return respan(parseDo());
        throw syntaxError("unknown statement " + keyword);
    }

    ExpressionPointer parseAssignName(bool dotted) {
        SpannedToken name = expectKind(TokenKind::Identifier, "identifier");
        if (std::ranges::find(kReservedNames, std::string_view(name.token.text)) != kReservedNames.end()) {
            throw syntaxError("cannot assign to reserved variable name " + name.token.text);
        }
        ExpressionPointer result = makeExpression(VariableExpression{std::move(name.token.text)}, name.span);
        if (dotted) {
            while (skipKind(TokenKind::Dot)) {
                SpannedToken attribute = expectKind(TokenKind::Identifier, "identifier");
                result = makeExpression(AttributeExpression{std::move(result), std::move(attribute.token.text)}, attribute.span);
            }
        }
        return result;
    }

    ExpressionPointer parseAssignment(bool dotted) {
        const TemplateSpan span = stream_.currentSpan();
        std::vector<ExpressionPointer> items;
        bool isTuple = false;
        for (;;) {
            if (!items.empty()) static_cast<void>(expectKind(TokenKind::Comma, "`,`"));
            if (matchesKind(TokenKind::ParenClose) || matchesKind(TokenKind::VariableEnd) || matchesKind(TokenKind::BlockEnd)
                || matchesIdentifier("in")) {
                break;
            }
            if (skipKind(TokenKind::ParenOpen)) {
                ExpressionPointer nested = parseAssignment(dotted);
                static_cast<void>(expectKind(TokenKind::ParenClose, "`)`"));
                items.push_back(std::move(nested));
            }
            else {
                items.push_back(parseAssignName(dotted));
            }
            if (matchesKind(TokenKind::Comma)) isTuple = true;
            else break;
        }
        if (!isTuple && items.size() == 1) return std::move(items.front());
        return makeExpression(ListExpression{std::move(items)}, stream_.expandSpan(span));
    }

    ForLoopStatement parseForStatement() {
        ForLoopStatement loop;
        loop.target = parseAssignment(false);
        static_cast<void>(expectIdentifierNamed("in", "in"));
        loop.iterable = parseExpressionWithoutConditional();
        if (skipIdentifier("if")) loop.filter = parseExpression();
        loop.recursive = skipIdentifier("recursive");
        static_cast<void>(expectKind(TokenKind::BlockEnd, "end of block"));
        loop.body = subparse([](const SpannedToken& token) {
            return token.token.kind == TokenKind::Identifier && (token.token.text == "endfor" || token.token.text == "else");
        });
        if (skipIdentifier("else")) {
            static_cast<void>(expectKind(TokenKind::BlockEnd, "end of block"));
            loop.elseBody = subparse([](const SpannedToken& token) {
                return token.token.kind == TokenKind::Identifier && token.token.text == "endfor";
            });
        }
        static_cast<void>(stream_.next());
        return loop;
    }

    IfStatement parseIfCondition() {
        IfStatement condition;
        condition.condition = parseExpressionWithoutConditional();
        static_cast<void>(expectKind(TokenKind::BlockEnd, "end of block"));
        condition.trueBody = subparse([](const SpannedToken& token) {
            return token.token.kind == TokenKind::Identifier
                && (token.token.text == "endif" || token.token.text == "else" || token.token.text == "elif");
        });
        auto next = stream_.next();
        if (next && next->token.kind == TokenKind::Identifier && next->token.text == "else") {
            static_cast<void>(expectKind(TokenKind::BlockEnd, "end of block"));
            condition.falseBody = subparse([](const SpannedToken& token) {
                return token.token.kind == TokenKind::Identifier && token.token.text == "endif";
            });
            static_cast<void>(stream_.next());
        }
        else if (next && next->token.kind == TokenKind::Identifier && next->token.text == "elif") {
            const TemplateSpan elifSpan = next->span;
            IfStatement nested = parseIfCondition();
            condition.falseBody.push_back(makeStatement(std::move(nested), stream_.expandSpan(elifSpan)));
        }
        return condition;
    }

    WithStatement parseWithBlock() {
        WithStatement block;
        while (!matchesKind(TokenKind::BlockEnd)) {
            if (!block.assignments.empty()) static_cast<void>(expectKind(TokenKind::Comma, "comma"));
            ExpressionPointer target;
            if (skipKind(TokenKind::ParenOpen)) {
                target = parseAssignment(false);
                static_cast<void>(expectKind(TokenKind::ParenClose, "`)`"));
            }
            else {
                target = parseAssignName(false);
            }
            static_cast<void>(expectKind(TokenKind::Assign, "assignment operator"));
            block.assignments.emplace_back(std::move(target), parseExpression());
        }
        static_cast<void>(expectKind(TokenKind::BlockEnd, "end of block"));
        block.body = subparse([](const SpannedToken& token) {
            return token.token.kind == TokenKind::Identifier && token.token.text == "endwith";
        });
        static_cast<void>(stream_.next());
        return block;
    }

    std::variant<SetStatement, SetBlockStatement> parseSet() {
        ExpressionPointer target = parseAssignment(true);
        if (matchesKind(TokenKind::BlockEnd) || matchesKind(TokenKind::Pipe)) {
            SetBlockStatement block;
            block.target = std::move(target);
            if (skipKind(TokenKind::Pipe)) block.filter = parseFilterChain();
            static_cast<void>(expectKind(TokenKind::BlockEnd, "end of block"));
            block.body = subparse([](const SpannedToken& token) {
                return token.token.kind == TokenKind::Identifier && token.token.text == "endset";
            });
            static_cast<void>(stream_.next());
            return block;
        }
        static_cast<void>(expectKind(TokenKind::Assign, "assignment operator"));
        ExpressionPointer expression = parseExpression();
        if (skipKind(TokenKind::Comma)) {
            const TemplateSpan span = stream_.currentSpan();
            std::vector<ExpressionPointer> items;
            items.push_back(std::move(expression));
            for (;;) {
                if (matchesKind(TokenKind::BlockEnd)) break;
                items.push_back(parseExpression());
                if (!skipKind(TokenKind::Comma)) break;
            }
            expression = makeExpression(ListExpression{std::move(items)}, stream_.expandSpan(span));
        }
        return SetStatement{std::move(target), std::move(expression)};
    }

    BlockStatement parseBlock() {
        if (inMacro_) throw syntaxError("block tags in macros are not allowed");
        const bool oldInLoop = std::exchange(inLoop_, false);
        SpannedToken name = expectKind(TokenKind::Identifier, "identifier");
        if (std::ranges::find(blocks_, name.token.text) != blocks_.end()) throw syntaxError("block '" + name.token.text + "' defined twice");
        blocks_.push_back(name.token.text);
        static_cast<void>(expectKind(TokenKind::BlockEnd, "end of block"));
        BlockStatement block;
        block.name = name.token.text;
        block.body = subparse([](const SpannedToken& token) {
            return token.token.kind == TokenKind::Identifier && token.token.text == "endblock";
        });
        static_cast<void>(stream_.next());
        if (const SpannedToken* trailing = stream_.current(); trailing != nullptr && trailing->token.kind == TokenKind::Identifier) {
            if (trailing->token.text != block.name) {
                throw syntaxError("mismatching name on block. Got `" + trailing->token.text + "`, expected `" + block.name + "`");
            }
            static_cast<void>(stream_.next());
        }
        inLoop_ = oldInLoop;
        return block;
    }

    AutoEscapeStatement parseAutoEscape() {
        AutoEscapeStatement statement;
        statement.enabled = parseExpression();
        static_cast<void>(expectKind(TokenKind::BlockEnd, "end of block"));
        statement.body = subparse([](const SpannedToken& token) {
            return token.token.kind == TokenKind::Identifier && token.token.text == "endautoescape";
        });
        static_cast<void>(stream_.next());
        return statement;
    }

    ExpressionPointer parseFilterChain() {
        ExpressionPointer filter;
        while (!matchesKind(TokenKind::BlockEnd)) {
            if (filter) static_cast<void>(expectKind(TokenKind::Pipe, "`|`"));
            SpannedToken name = expectKind(TokenKind::Identifier, "identifier");
            std::vector<CallArgument> arguments;
            if (matchesKind(TokenKind::ParenOpen)) arguments = parseArguments();
            filter = makeExpression(FilterExpression{std::move(name.token.text), std::move(filter), std::move(arguments)}, stream_.expandSpan(name.span));
        }
        if (!filter) throw syntaxError("expected a filter");
        return filter;
    }

    FilterBlockStatement parseFilterBlock() {
        FilterBlockStatement statement;
        statement.filter = parseFilterChain();
        static_cast<void>(expectKind(TokenKind::BlockEnd, "end of block"));
        statement.body = subparse([](const SpannedToken& token) {
            return token.token.kind == TokenKind::Identifier && token.token.text == "endfilter";
        });
        static_cast<void>(stream_.next());
        return statement;
    }

    bool skipContextMarker() {
        if (matchesIdentifier("with") || matchesIdentifier("without")) {
            static_cast<void>(stream_.next());
            static_cast<void>(expectIdentifierNamed("context", "context"));
            return true;
        }
        return false;
    }

    IncludeStatement parseInclude() {
        IncludeStatement statement;
        statement.name = parseExpression();
        const bool skippedContext = skipContextMarker();
        if (skipIdentifier("ignore")) {
            static_cast<void>(expectIdentifierNamed("missing", "missing keyword"));
            if (!skippedContext) static_cast<void>(skipContextMarker());
            statement.ignoreMissing = true;
        }
        return statement;
    }

    ImportStatement parseImport() {
        ImportStatement statement;
        statement.expression = parseExpression();
        static_cast<void>(expectIdentifierNamed("as", "as"));
        statement.name = parseExpression();
        static_cast<void>(skipContextMarker());
        return statement;
    }

    FromImportStatement parseFromImport() {
        FromImportStatement statement;
        statement.expression = parseExpression();
        static_cast<void>(expectIdentifierNamed("import", "import"));
        for (;;) {
            if (skipContextMarker() || matchesKind(TokenKind::BlockEnd)) break;
            if (!statement.names.empty()) static_cast<void>(expectKind(TokenKind::Comma, "`,`"));
            if (skipContextMarker() || matchesKind(TokenKind::BlockEnd)) break;
            ExpressionPointer name = parseAssignName(false);
            ExpressionPointer alias;
            if (skipIdentifier("as")) alias = parseAssignName(false);
            statement.names.emplace_back(std::move(name), std::move(alias));
        }
        return statement;
    }

    void parseMacroArgumentsAndDefaults(std::vector<ExpressionPointer>& arguments, std::vector<ExpressionPointer>& defaults) {
        for (;;) {
            if (skipKind(TokenKind::ParenClose)) break;
            if (!arguments.empty()) {
                static_cast<void>(expectKind(TokenKind::Comma, "`,`"));
                if (skipKind(TokenKind::ParenClose)) break;
            }
            arguments.push_back(parseAssignName(false));
            if (skipKind(TokenKind::Assign)) defaults.push_back(parseExpression());
            else if (!defaults.empty()) static_cast<void>(expectKind(TokenKind::Assign, "`=`"));
        }
    }

    MacroStatement parseMacroOrCallBlockBody(std::vector<ExpressionPointer> arguments, std::vector<ExpressionPointer> defaults,
        std::optional<std::string> name) {
        static_cast<void>(expectKind(TokenKind::BlockEnd, "end of block"));
        const bool oldInLoop = std::exchange(inLoop_, false);
        const bool oldInMacro = std::exchange(inMacro_, true);
        const bool named = name.has_value();
        StatementList body = subparse([named](const SpannedToken& token) {
            if (token.token.kind != TokenKind::Identifier) return false;
            return named ? token.token.text == "endmacro" : token.token.text == "endcall";
        });
        inMacro_ = oldInMacro;
        inLoop_ = oldInLoop;
        static_cast<void>(stream_.next());
        MacroStatement macro;
        macro.name = name.value_or("caller");
        macro.arguments = std::move(arguments);
        macro.defaults = std::move(defaults);
        macro.body = std::move(body);
        return macro;
    }

    MacroStatement parseMacro() {
        SpannedToken name = expectKind(TokenKind::Identifier, "identifier");
        static_cast<void>(expectKind(TokenKind::ParenOpen, "`(`"));
        std::vector<ExpressionPointer> arguments;
        std::vector<ExpressionPointer> defaults;
        parseMacroArgumentsAndDefaults(arguments, defaults);
        return parseMacroOrCallBlockBody(std::move(arguments), std::move(defaults), std::move(name.token.text));
    }

    CallBlockStatement parseCallBlock() {
        const TemplateSpan span = stream_.lastSpan();
        std::vector<ExpressionPointer> arguments;
        std::vector<ExpressionPointer> defaults;
        if (skipKind(TokenKind::ParenOpen)) parseMacroArgumentsAndDefaults(arguments, defaults);
        ExpressionPointer call = parseExpression();
        if (!std::holds_alternative<CallExpression>(call->node)) {
            throw syntaxError("expected call expression in call block, got " + std::string(expressionDescription(*call)));
        }
        CallBlockStatement statement;
        statement.call = std::move(call);
        statement.macroDeclaration = parseMacroOrCallBlockBody(std::move(arguments), std::move(defaults), std::nullopt);
        statement.macroSpan = stream_.expandSpan(span);
        return statement;
    }

    DoStatement parseDo() {
        ExpressionPointer call = parseExpression();
        if (!std::holds_alternative<CallExpression>(call->node)) {
            throw syntaxError("expected call expression in call block, got " + std::string(expressionDescription(*call)));
        }
        return DoStatement{std::move(call)};
    }

    StatementList subparse(const std::function<bool(const SpannedToken&)>& endCheck) {
        StatementList result;
        while (auto token = stream_.next()) {
            switch (token->token.kind) {
            case TokenKind::TemplateData:
                result.push_back(makeStatement(EmitRawStatement{std::move(token->token.text)}, token->span));
                break;
            case TokenKind::VariableStart: {
                ExpressionPointer expression = parseExpression();
                result.push_back(makeStatement(EmitExpressionStatement{std::move(expression)}, stream_.expandSpan(token->span)));
                static_cast<void>(expectKind(TokenKind::VariableEnd, "end of variable block"));
                break;
            }
            case TokenKind::BlockStart: {
                const SpannedToken* current = stream_.current();
                if (current == nullptr) throw syntaxError("unexpected end of input, expected keyword");
                if (endCheck(*current)) return result;
                result.push_back(parseStatement());
                static_cast<void>(expectKind(TokenKind::BlockEnd, "end of block"));
                break;
            }
            default:
                throw syntaxError("lexer produced garbage");
            }
        }
        return result;
    }

    TokenStream stream_;
    bool inMacro_ = false;
    bool inLoop_ = false;
    std::vector<std::string> blocks_;
    std::size_t depth_ = 0;
};

}

std::string_view expressionDescription(const Expression& expression) noexcept {
    switch (expression.node.index()) {
    case 0: return "variable";
    case 1: return "constant";
    case 10: return "call";
    case 11: return "list literal";
    case 12: return "map literal";
    case 7: return "test expression";
    case 6: return "filter expression";
    default: return "expression";
    }
}

std::optional<Value> constantValueOf(const Expression& expression) {
    if (const auto* constant = std::get_if<ConstantExpression>(&expression.node)) return constant->value;
    if (const auto* list = std::get_if<ListExpression>(&expression.node)) {
        std::vector<Value> values;
        for (const auto& item : list->items) {
            const auto* constant = std::get_if<ConstantExpression>(&item->node);
            if (constant == nullptr) return std::nullopt;
            values.push_back(constant->value);
        }
        return Value::fromSequence(std::move(values));
    }
    if (const auto* map = std::get_if<MapExpression>(&expression.node)) {
        ValueMap values;
        for (std::size_t index = 0; index < map->keys.size(); ++index) {
            const auto* key = std::get_if<ConstantExpression>(&map->keys[index]->node);
            const auto* value = std::get_if<ConstantExpression>(&map->values[index]->node);
            if (key == nullptr || value == nullptr) return std::nullopt;
        }
        for (std::size_t index = 0; index < map->keys.size(); ++index) {
            values.insert(std::get<ConstantExpression>(map->keys[index]->node).value, std::get<ConstantExpression>(map->values[index]->node).value);
        }
        return makeMap(std::move(values));
    }
    if (const auto* unary = std::get_if<UnaryExpression>(&expression.node)) {
        const auto operand = constantValueOf(*unary->operand);
        if (!operand) return std::nullopt;
        if (unary->kind == UnaryOperatorKind::Not) return Value::fromBool(!operand->isTrue());
        try {
            return negateValue(*operand);
        }
        catch (const TemplateError&) {
            return std::nullopt;
        }
    }
    if (const auto* binary = std::get_if<BinaryExpression>(&expression.node)) {
        const auto left = constantValueOf(*binary->left);
        const auto right = constantValueOf(*binary->right);
        if (!left || !right) return std::nullopt;
        const auto attempt = [](const std::function<Value()>& operation) -> std::optional<Value> {
            try {
                return operation();
            }
            catch (const TemplateError&) {
                return std::nullopt;
            }
        };
        switch (binary->kind) {
        case BinaryOperatorKind::Add: return attempt([&] { return addValues(*left, *right); });
        case BinaryOperatorKind::Subtract: return attempt([&] { return subtractValues(*left, *right); });
        case BinaryOperatorKind::Multiply: return attempt([&] { return multiplyValues(*left, *right); });
        case BinaryOperatorKind::Divide: return attempt([&] { return divideValues(*left, *right); });
        case BinaryOperatorKind::FloorDivide: return attempt([&] { return integerDivideValues(*left, *right); });
        case BinaryOperatorKind::Remainder: return attempt([&] { return remainderValues(*left, *right); });
        case BinaryOperatorKind::Power: return attempt([&] { return powerValues(*left, *right); });
        case BinaryOperatorKind::Concatenate: return concatenateValues(*left, *right);
        case BinaryOperatorKind::Equal: return Value::fromBool(*left == *right);
        case BinaryOperatorKind::NotEqual: return Value::fromBool(!(*left == *right));
        case BinaryOperatorKind::Less: return Value::fromBool(left->compare(*right) == std::strong_ordering::less);
        case BinaryOperatorKind::LessEqual: return Value::fromBool(left->compare(*right) != std::strong_ordering::greater);
        case BinaryOperatorKind::Greater: return Value::fromBool(left->compare(*right) == std::strong_ordering::greater);
        case BinaryOperatorKind::GreaterEqual: return Value::fromBool(left->compare(*right) != std::strong_ordering::less);
        case BinaryOperatorKind::In: return attempt([&] { return containsValue(*right, *left); });
        case BinaryOperatorKind::ShortCircuitAnd: return left->isTrue() && right->isTrue() ? *right : Value::fromBool(false);
        case BinaryOperatorKind::ShortCircuitOr: return left->isTrue() ? *left : *right;
        }
    }
    return std::nullopt;
}

Statement parseTemplate(std::string_view source, std::string_view filename, WhitespaceConfiguration whitespace) {
    return Parser(source, filename, false, whitespace).parse();
}

ExpressionPointer parseStandaloneExpression(std::string_view source) {
    return Parser(source, "<expression>", true, WhitespaceConfiguration{}).parseStandalone();
}

}
