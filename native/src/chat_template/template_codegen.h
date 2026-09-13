#pragma once

#include <cstddef>
#include <cstdint>
#include <map>
#include <optional>
#include <span>
#include <string>
#include <utility>
#include <vector>

#include "chat_template/template_ast.h"
#include "chat_template/template_instructions.h"

namespace eversoul::native::chat_template {

struct CompiledInstructions {
    Instructions instructions;
    std::map<std::string, Instructions, std::less<>> blocks;
    std::size_t bufferSizeHint = 0;
};

class CodeGenerator {
public:
    CodeGenerator(std::string name, std::string source);

    void compileStatement(const Statement& statement);
    void compileExpression(const Expression& expression);
    [[nodiscard]] CompiledInstructions finish();

private:
    struct PendingBlock {
        enum class Kind { Branch, Loop, ShortCircuit };
        Kind kind;
        std::uint32_t jumpInstruction = 0;
        std::uint32_t iterateInstruction = 0;
        std::vector<std::uint32_t> jumpInstructions;
    };

    void setLine(std::uint16_t line) noexcept { currentLine_ = line; }
    void setLineFromSpan(TemplateSpan span) noexcept { currentLine_ = span.startLine; }
    void pushSpan(TemplateSpan span);
    void popSpan();
    std::uint32_t add(Instruction instruction);
    std::uint32_t addWithSpan(Instruction instruction, TemplateSpan span);
    [[nodiscard]] std::uint32_t nextInstruction() const noexcept { return static_cast<std::uint32_t>(instructions_.size()); }
    [[nodiscard]] CodeGenerator subgenerator() const;

    void startForLoop(bool withLoopVariable, bool recursive);
    void endForLoop(bool pushDidNotIterate);
    void startIf();
    void startElse();
    void endIf();
    void startShortCircuit();
    void shortCircuit(bool conjunction);
    void endShortCircuit();
    void endCondition(std::uint32_t newJumpTarget);

    void compileBlock(const BlockStatement& block, TemplateSpan span);
    void compileMacroExpression(const MacroStatement& macro, TemplateSpan span);
    void compileMacro(const MacroStatement& macro, TemplateSpan span);
    void compileCallBlock(const CallBlockStatement& callBlock);
    void compileDo(const DoStatement& statement);
    void compileIf(const IfStatement& statement, TemplateSpan span);
    void compileEmitExpression(const EmitExpressionStatement& statement, TemplateSpan span);
    void compileForLoop(const ForLoopStatement& statement, TemplateSpan span);
    void compileAssignment(const Expression& expression);
    void compileCall(const Expression& callExpression, const MacroStatement* caller, TemplateSpan callerSpan);
    [[nodiscard]] std::optional<std::size_t> compileCallArguments(std::span<const CallArgument> arguments, std::size_t extraArguments,
        const MacroStatement* caller, TemplateSpan callerSpan);
    void compileBinaryOperation(const BinaryExpression& expression, TemplateSpan span);
    [[nodiscard]] std::uint8_t filterLocalId(const std::string& name);
    [[nodiscard]] std::uint8_t testLocalId(const std::string& name);

    Instructions instructions_;
    std::map<std::string, Instructions, std::less<>> blocks_;
    std::vector<PendingBlock> pendingBlocks_;
    std::uint16_t currentLine_ = 0;
    std::vector<TemplateSpan> spanStack_;
    std::map<std::string, std::uint8_t, std::less<>> filterLocalIds_;
    std::map<std::string, std::uint8_t, std::less<>> testLocalIds_;
    std::size_t rawTemplateBytes_ = 0;
};

}
