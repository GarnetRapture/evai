#pragma once

#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <variant>
#include <vector>

#include "chat_template/template_error.h"
#include "chat_template/template_value.h"

namespace eversoul::native::chat_template {

struct Expression;
using ExpressionPointer = std::unique_ptr<Expression>;

enum class UnaryOperatorKind { Not, Negate };

enum class BinaryOperatorKind {
    Equal,
    NotEqual,
    Less,
    LessEqual,
    Greater,
    GreaterEqual,
    ShortCircuitAnd,
    ShortCircuitOr,
    Add,
    Subtract,
    Multiply,
    Divide,
    FloorDivide,
    Remainder,
    Power,
    Concatenate,
    In,
};

enum class CallArgumentKind { Positional, Keyword, PositionalSplat, KeywordSplat };

struct CallArgument {
    CallArgumentKind kind = CallArgumentKind::Positional;
    std::string name;
    ExpressionPointer value;
};

struct VariableExpression {
    std::string identifier;
};

struct ConstantExpression {
    Value value;
};

struct SliceExpression {
    ExpressionPointer target;
    ExpressionPointer start;
    ExpressionPointer stop;
    ExpressionPointer step;
};

struct UnaryExpression {
    UnaryOperatorKind kind = UnaryOperatorKind::Not;
    ExpressionPointer operand;
};

struct BinaryExpression {
    BinaryOperatorKind kind = BinaryOperatorKind::Equal;
    ExpressionPointer left;
    ExpressionPointer right;
};

struct ConditionalExpression {
    ExpressionPointer test;
    ExpressionPointer whenTrue;
    ExpressionPointer whenFalse;
};

struct FilterExpression {
    std::string name;
    ExpressionPointer operand;
    std::vector<CallArgument> arguments;
};

struct TestExpression {
    std::string name;
    ExpressionPointer operand;
    std::vector<CallArgument> arguments;
};

struct AttributeExpression {
    ExpressionPointer target;
    std::string name;
};

struct ItemExpression {
    ExpressionPointer target;
    ExpressionPointer subscript;
};

struct CallExpression {
    ExpressionPointer target;
    std::vector<CallArgument> arguments;
};

struct ListExpression {
    std::vector<ExpressionPointer> items;
};

struct MapExpression {
    std::vector<ExpressionPointer> keys;
    std::vector<ExpressionPointer> values;
};

struct Expression {
    std::variant<
        VariableExpression,
        ConstantExpression,
        SliceExpression,
        UnaryExpression,
        BinaryExpression,
        ConditionalExpression,
        FilterExpression,
        TestExpression,
        AttributeExpression,
        ItemExpression,
        CallExpression,
        ListExpression,
        MapExpression>
        node;
    TemplateSpan span;
};

struct Statement;
using StatementList = std::vector<Statement>;

struct TemplateStatement {
    StatementList children;
};

struct EmitExpressionStatement {
    ExpressionPointer expression;
};

struct EmitRawStatement {
    std::string raw;
};

struct ForLoopStatement {
    ExpressionPointer target;
    ExpressionPointer iterable;
    ExpressionPointer filter;
    bool recursive = false;
    StatementList body;
    StatementList elseBody;
};

struct IfStatement {
    ExpressionPointer condition;
    StatementList trueBody;
    StatementList falseBody;
};

struct WithStatement {
    std::vector<std::pair<ExpressionPointer, ExpressionPointer>> assignments;
    StatementList body;
};

struct SetStatement {
    ExpressionPointer target;
    ExpressionPointer expression;
};

struct SetBlockStatement {
    ExpressionPointer target;
    ExpressionPointer filter;
    StatementList body;
};

struct AutoEscapeStatement {
    ExpressionPointer enabled;
    StatementList body;
};

struct FilterBlockStatement {
    ExpressionPointer filter;
    StatementList body;
};

struct BlockStatement {
    std::string name;
    StatementList body;
};

struct ExtendsStatement {
    ExpressionPointer name;
};

struct IncludeStatement {
    ExpressionPointer name;
    bool ignoreMissing = false;
};

struct ImportStatement {
    ExpressionPointer expression;
    ExpressionPointer name;
};

struct FromImportStatement {
    ExpressionPointer expression;
    std::vector<std::pair<ExpressionPointer, ExpressionPointer>> names;
};

struct MacroStatement {
    std::string name;
    std::vector<ExpressionPointer> arguments;
    std::vector<ExpressionPointer> defaults;
    StatementList body;
};

struct CallBlockStatement {
    ExpressionPointer call;
    MacroStatement macroDeclaration;
    TemplateSpan macroSpan;
};

struct DoStatement {
    ExpressionPointer call;
};

struct Statement {
    std::variant<
        TemplateStatement,
        EmitExpressionStatement,
        EmitRawStatement,
        ForLoopStatement,
        IfStatement,
        WithStatement,
        SetStatement,
        SetBlockStatement,
        AutoEscapeStatement,
        FilterBlockStatement,
        BlockStatement,
        ImportStatement,
        FromImportStatement,
        ExtendsStatement,
        IncludeStatement,
        MacroStatement,
        CallBlockStatement,
        DoStatement>
        node;
    TemplateSpan span;
};

[[nodiscard]] std::string_view expressionDescription(const Expression& expression) noexcept;
[[nodiscard]] std::optional<Value> constantValueOf(const Expression& expression);

}
