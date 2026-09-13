#include "chat_template/template_codegen.h"

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <initializer_list>
#include <map>
#include <optional>
#include <set>
#include <span>
#include <string>
#include <utility>
#include <variant>
#include <vector>

#include "chat_template/template_ast.h"
#include "chat_template/template_error.h"
#include "chat_template/template_instructions.h"
#include "chat_template/template_meta.h"
#include "chat_template/template_operations.h"
#include "chat_template/template_value.h"

namespace eversoul::native::chat_template {
namespace {

Instruction instruction(InstructionKind kind) {
    Instruction result;
    result.kind = kind;
    return result;
}

Instruction namedInstruction(InstructionKind kind, std::string name) {
    Instruction result;
    result.kind = kind;
    result.name = std::move(name);
    return result;
}

Instruction countInstruction(InstructionKind kind, std::size_t count) {
    Instruction result;
    result.kind = kind;
    result.count = count;
    return result;
}

Instruction jumpInstruction(InstructionKind kind, std::uint32_t target) {
    Instruction result;
    result.kind = kind;
    result.target = target;
    return result;
}

Instruction constantInstruction(Value value) {
    Instruction result;
    result.kind = InstructionKind::LoadConst;
    result.constant = std::move(value);
    return result;
}

std::uint8_t localId(std::map<std::string, std::uint8_t, std::less<>>& ids, const std::string& name) {
    if (const auto found = ids.find(name); found != ids.end()) return found->second;
    if (ids.size() >= kMaximumLocals) return kUncachedLocal;
    const auto next = static_cast<std::uint8_t>(ids.size());
    ids.emplace(name, next);
    return next;
}

std::size_t nextPowerOfTwo(std::size_t value) noexcept {
    std::size_t result = 1;
    while (result < value) result <<= 1U;
    return result;
}

}

CodeGenerator::CodeGenerator(std::string name, std::string source) : instructions_(std::move(name), std::move(source)) {
    pendingBlocks_.reserve(32);
    spanStack_.reserve(32);
}

void CodeGenerator::pushSpan(TemplateSpan span) {
    spanStack_.push_back(span);
    setLineFromSpan(span);
}

void CodeGenerator::popSpan() {
    spanStack_.pop_back();
}

std::uint32_t CodeGenerator::add(Instruction value) {
    if (!spanStack_.empty() && spanStack_.back().startLine == currentLine_) {
        return instructions_.addWithSpan(std::move(value), spanStack_.back());
    }
    return instructions_.addWithLine(std::move(value), currentLine_);
}

std::uint32_t CodeGenerator::addWithSpan(Instruction value, TemplateSpan span) {
    return instructions_.addWithSpan(std::move(value), span);
}

CodeGenerator CodeGenerator::subgenerator() const {
    CodeGenerator generator(instructions_.name(), instructions_.source());
    generator.currentLine_ = currentLine_;
    if (!spanStack_.empty()) generator.spanStack_.push_back(spanStack_.back());
    return generator;
}

void CodeGenerator::startForLoop(bool withLoopVariable, bool recursive) {
    std::uint8_t flags = 0;
    if (withLoopVariable) flags |= kLoopFlagWithLoopVariable;
    if (recursive) flags |= kLoopFlagRecursive;
    Instruction pushLoop = instruction(InstructionKind::PushLoop);
    pushLoop.flags = flags;
    static_cast<void>(add(std::move(pushLoop)));
    const std::uint32_t iterate = add(jumpInstruction(InstructionKind::Iterate, UINT32_MAX));
    pendingBlocks_.push_back(PendingBlock{PendingBlock::Kind::Loop, 0, iterate, {}});
}

void CodeGenerator::endForLoop(bool pushDidNotIterate) {
    PendingBlock block = std::move(pendingBlocks_.back());
    pendingBlocks_.pop_back();
    static_cast<void>(add(jumpInstruction(InstructionKind::Jump, block.iterateInstruction)));
    const std::uint32_t loopEnd = nextInstruction();
    if (pushDidNotIterate) static_cast<void>(add(instruction(InstructionKind::PushDidNotIterate)));
    static_cast<void>(add(instruction(InstructionKind::PopLoopFrame)));
    block.jumpInstructions.push_back(block.iterateInstruction);
    for (std::uint32_t index : block.jumpInstructions) instructions_.getMutable(index)->target = loopEnd;
}

void CodeGenerator::startIf() {
    const std::uint32_t jump = add(jumpInstruction(InstructionKind::JumpIfFalse, UINT32_MAX));
    pendingBlocks_.push_back(PendingBlock{PendingBlock::Kind::Branch, jump, 0, {}});
}

void CodeGenerator::startElse() {
    const std::uint32_t jump = add(jumpInstruction(InstructionKind::Jump, UINT32_MAX));
    endCondition(jump + 1);
    pendingBlocks_.push_back(PendingBlock{PendingBlock::Kind::Branch, jump, 0, {}});
}

void CodeGenerator::endIf() {
    endCondition(nextInstruction());
}

void CodeGenerator::startShortCircuit() {
    pendingBlocks_.push_back(PendingBlock{PendingBlock::Kind::ShortCircuit, 0, 0, {}});
}

void CodeGenerator::shortCircuit(bool conjunction) {
    const std::uint32_t jump = instructions_.add(jumpInstruction(
        conjunction ? InstructionKind::JumpIfFalseOrPop : InstructionKind::JumpIfTrueOrPop, UINT32_MAX));
    pendingBlocks_.back().jumpInstructions.push_back(jump);
}

void CodeGenerator::endShortCircuit() {
    const std::uint32_t end = nextInstruction();
    PendingBlock block = std::move(pendingBlocks_.back());
    pendingBlocks_.pop_back();
    for (std::uint32_t index : block.jumpInstructions) instructions_.getMutable(index)->target = end;
}

void CodeGenerator::endCondition(std::uint32_t newJumpTarget) {
    PendingBlock block = std::move(pendingBlocks_.back());
    pendingBlocks_.pop_back();
    if (Instruction* jump = instructions_.getMutable(block.jumpInstruction)) {
        if (jump->kind == InstructionKind::JumpIfFalse || jump->kind == InstructionKind::Jump) jump->target = newJumpTarget;
    }
}

void CodeGenerator::compileStatement(const Statement& statement) {
    const TemplateSpan span = statement.span;
    if (const auto* node = std::get_if<TemplateStatement>(&statement.node)) {
        setLineFromSpan(span);
        for (const auto& child : node->children) compileStatement(child);
    }
    else if (const auto* node = std::get_if<EmitExpressionStatement>(&statement.node)) {
        compileEmitExpression(*node, span);
    }
    else if (const auto* node = std::get_if<EmitRawStatement>(&statement.node)) {
        setLineFromSpan(span);
        static_cast<void>(add(namedInstruction(InstructionKind::EmitRaw, node->raw)));
        rawTemplateBytes_ += node->raw.size();
    }
    else if (const auto* node = std::get_if<ForLoopStatement>(&statement.node)) {
        compileForLoop(*node, span);
    }
    else if (const auto* node = std::get_if<IfStatement>(&statement.node)) {
        compileIf(*node, span);
    }
    else if (const auto* node = std::get_if<WithStatement>(&statement.node)) {
        setLineFromSpan(span);
        static_cast<void>(add(instruction(InstructionKind::PushWith)));
        for (const auto& [target, expression] : node->assignments) {
            compileExpression(*expression);
            compileAssignment(*target);
        }
        for (const auto& child : node->body) compileStatement(child);
        static_cast<void>(add(instruction(InstructionKind::PopFrame)));
    }
    else if (const auto* node = std::get_if<SetStatement>(&statement.node)) {
        setLineFromSpan(span);
        compileExpression(*node->expression);
        compileAssignment(*node->target);
    }
    else if (const auto* node = std::get_if<SetBlockStatement>(&statement.node)) {
        setLineFromSpan(span);
        Instruction begin = instruction(InstructionKind::BeginCapture);
        begin.captureMode = CaptureMode::Capture;
        static_cast<void>(add(std::move(begin)));
        for (const auto& child : node->body) compileStatement(child);
        static_cast<void>(add(instruction(InstructionKind::EndCapture)));
        if (node->filter) compileExpression(*node->filter);
        compileAssignment(*node->target);
    }
    else if (const auto* node = std::get_if<AutoEscapeStatement>(&statement.node)) {
        setLineFromSpan(span);
        compileExpression(*node->enabled);
        static_cast<void>(add(instruction(InstructionKind::PushAutoEscape)));
        for (const auto& child : node->body) compileStatement(child);
        static_cast<void>(add(instruction(InstructionKind::PopAutoEscape)));
    }
    else if (const auto* node = std::get_if<FilterBlockStatement>(&statement.node)) {
        setLineFromSpan(span);
        Instruction begin = instruction(InstructionKind::BeginCapture);
        begin.captureMode = CaptureMode::Capture;
        static_cast<void>(add(std::move(begin)));
        for (const auto& child : node->body) compileStatement(child);
        static_cast<void>(add(instruction(InstructionKind::EndCapture)));
        compileExpression(*node->filter);
        static_cast<void>(add(instruction(InstructionKind::Emit)));
    }
    else if (const auto* node = std::get_if<BlockStatement>(&statement.node)) {
        compileBlock(*node, span);
    }
    else if (const auto* node = std::get_if<ImportStatement>(&statement.node)) {
        Instruction begin = instruction(InstructionKind::BeginCapture);
        begin.captureMode = CaptureMode::Capture;
        static_cast<void>(add(std::move(begin)));
        static_cast<void>(add(instruction(InstructionKind::PushWith)));
        compileExpression(*node->expression);
        Instruction include = instruction(InstructionKind::Include);
        include.enabled = false;
        static_cast<void>(addWithSpan(std::move(include), span));
        static_cast<void>(add(instruction(InstructionKind::EndCapture)));
        static_cast<void>(add(instruction(InstructionKind::ExportLocals)));
        static_cast<void>(add(instruction(InstructionKind::PopFrame)));
        compileAssignment(*node->name);
    }
    else if (const auto* node = std::get_if<FromImportStatement>(&statement.node)) {
        Instruction begin = instruction(InstructionKind::BeginCapture);
        begin.captureMode = CaptureMode::Discard;
        static_cast<void>(add(std::move(begin)));
        static_cast<void>(add(instruction(InstructionKind::PushWith)));
        compileExpression(*node->expression);
        Instruction include = instruction(InstructionKind::Include);
        include.enabled = false;
        static_cast<void>(addWithSpan(std::move(include), span));
        for (const auto& [name, alias] : node->names) compileExpression(*name);
        static_cast<void>(add(instruction(InstructionKind::PopFrame)));
        for (auto entry = node->names.rbegin(); entry != node->names.rend(); ++entry) {
            compileAssignment(entry->second ? *entry->second : *entry->first);
        }
        static_cast<void>(add(instruction(InstructionKind::EndCapture)));
    }
    else if (const auto* node = std::get_if<ExtendsStatement>(&statement.node)) {
        setLineFromSpan(span);
        compileExpression(*node->name);
        static_cast<void>(addWithSpan(instruction(InstructionKind::LoadBlocks), span));
    }
    else if (const auto* node = std::get_if<IncludeStatement>(&statement.node)) {
        setLineFromSpan(span);
        compileExpression(*node->name);
        Instruction include = instruction(InstructionKind::Include);
        include.enabled = node->ignoreMissing;
        static_cast<void>(addWithSpan(std::move(include), span));
    }
    else if (const auto* node = std::get_if<MacroStatement>(&statement.node)) {
        compileMacro(*node, span);
    }
    else if (const auto* node = std::get_if<CallBlockStatement>(&statement.node)) {
        compileCallBlock(*node);
    }
    else if (const auto* node = std::get_if<DoStatement>(&statement.node)) {
        compileDo(*node);
    }
}

void CodeGenerator::compileBlock(const BlockStatement& block, TemplateSpan span) {
    setLineFromSpan(span);
    CodeGenerator generator = subgenerator();
    for (const auto& child : block.body) generator.compileStatement(child);
    currentLine_ = generator.currentLine_;
    CompiledInstructions compiled = generator.finish();
    for (auto& [name, instructions] : compiled.blocks) blocks_.insert_or_assign(name, std::move(instructions));
    blocks_.insert_or_assign(block.name, std::move(compiled.instructions));
    static_cast<void>(add(namedInstruction(InstructionKind::CallBlock, block.name)));
}

void CodeGenerator::compileMacroExpression(const MacroStatement& macro, TemplateSpan span) {
    setLineFromSpan(span);
    const std::uint32_t jump = add(jumpInstruction(InstructionKind::Jump, UINT32_MAX));
    auto defaults = macro.defaults.rbegin();
    for (auto argument = macro.arguments.rbegin(); argument != macro.arguments.rend(); ++argument) {
        if (defaults != macro.defaults.rend()) {
            static_cast<void>(add(instruction(InstructionKind::DupTop)));
            static_cast<void>(add(instruction(InstructionKind::IsUndefined)));
            startIf();
            static_cast<void>(add(instruction(InstructionKind::DiscardTop)));
            compileExpression(**defaults);
            endIf();
            ++defaults;
        }
        compileAssignment(**argument);
    }
    for (const auto& child : macro.body) compileStatement(child);
    static_cast<void>(add(instruction(InstructionKind::Return)));
    std::set<std::string> undeclared = findMacroClosure(macro);
    const bool callerReference = undeclared.erase("caller") > 0;
    const std::uint32_t macroInstruction = nextInstruction();
    for (const auto& name : undeclared) static_cast<void>(add(namedInstruction(InstructionKind::Enclose, name)));
    static_cast<void>(add(instruction(InstructionKind::GetClosure)));
    std::vector<Value> argumentNames;
    for (const auto& argument : macro.arguments) {
        argumentNames.push_back(Value::fromString(std::get<VariableExpression>(argument->node).identifier));
    }
    static_cast<void>(add(constantInstruction(Value::fromSequence(std::move(argumentNames)))));
    Instruction build = namedInstruction(InstructionKind::BuildMacro, macro.name);
    build.target = jump + 1;
    build.flags = callerReference ? kMacroCaller : 0;
    static_cast<void>(add(std::move(build)));
    instructions_.getMutable(jump)->target = macroInstruction;
}

void CodeGenerator::compileMacro(const MacroStatement& macro, TemplateSpan span) {
    compileMacroExpression(macro, span);
    static_cast<void>(add(namedInstruction(InstructionKind::StoreLocal, macro.name)));
}

void CodeGenerator::compileCallBlock(const CallBlockStatement& callBlock) {
    compileCall(*callBlock.call, &callBlock.macroDeclaration, callBlock.macroSpan);
    static_cast<void>(add(instruction(InstructionKind::Emit)));
}

void CodeGenerator::compileDo(const DoStatement& statement) {
    compileCall(*statement.call, nullptr, TemplateSpan{});
}

void CodeGenerator::compileIf(const IfStatement& statement, TemplateSpan span) {
    setLineFromSpan(span);
    pushSpan(statement.condition->span);
    compileExpression(*statement.condition);
    startIf();
    popSpan();
    for (const auto& child : statement.trueBody) compileStatement(child);
    if (!statement.falseBody.empty()) {
        startElse();
        for (const auto& child : statement.falseBody) compileStatement(child);
    }
    endIf();
}

void CodeGenerator::compileEmitExpression(const EmitExpressionStatement& statement, TemplateSpan) {
    const Expression& expression = *statement.expression;
    if (const auto* call = std::get_if<CallExpression>(&expression.node)) {
        setLineFromSpan(expression.span);
        if (const auto* function = std::get_if<VariableExpression>(&call->target->node)) {
            if (function->identifier == "super" && call->arguments.empty()) {
                static_cast<void>(addWithSpan(instruction(InstructionKind::FastSuper), expression.span));
                return;
            }
            if (function->identifier == "loop" && call->arguments.size() == 1) {
                static_cast<void>(compileCallArguments(std::span<const CallArgument>(call->arguments.data(), 1), 0, nullptr, TemplateSpan{}));
                static_cast<void>(addWithSpan(instruction(InstructionKind::FastRecurse), expression.span));
                return;
            }
        }
        else if (const auto* attribute = std::get_if<AttributeExpression>(&call->target->node)) {
            if (const auto* self = std::get_if<VariableExpression>(&attribute->target->node); self != nullptr && self->identifier == "self") {
                static_cast<void>(add(namedInstruction(InstructionKind::CallBlock, attribute->name)));
                return;
            }
        }
    }
    pushSpan(expression.span);
    compileExpression(expression);
    static_cast<void>(add(instruction(InstructionKind::Emit)));
    popSpan();
}

void CodeGenerator::compileForLoop(const ForLoopStatement& statement, TemplateSpan span) {
    setLineFromSpan(span);
    if (statement.filter) {
        static_cast<void>(add(constantInstruction(Value::fromUInt64(0))));
        pushSpan(statement.filter->span);
        compileExpression(*statement.iterable);
        startForLoop(false, false);
        static_cast<void>(add(instruction(InstructionKind::DupTop)));
        compileAssignment(*statement.target);
        compileExpression(*statement.filter);
        startIf();
        static_cast<void>(add(instruction(InstructionKind::Swap)));
        static_cast<void>(add(constantInstruction(Value::fromUInt64(1))));
        static_cast<void>(add(instruction(InstructionKind::Add)));
        startElse();
        static_cast<void>(add(instruction(InstructionKind::DiscardTop)));
        endIf();
        popSpan();
        endForLoop(false);
        Instruction buildList = instruction(InstructionKind::BuildList);
        buildList.optionalCount.reset();
        static_cast<void>(add(std::move(buildList)));
        startForLoop(true, statement.recursive);
    }
    else {
        pushSpan(statement.iterable->span);
        compileExpression(*statement.iterable);
        startForLoop(true, statement.recursive);
        popSpan();
    }
    compileAssignment(*statement.target);
    for (const auto& child : statement.body) compileStatement(child);
    endForLoop(!statement.elseBody.empty());
    if (!statement.elseBody.empty()) {
        startIf();
        for (const auto& child : statement.elseBody) compileStatement(child);
        endIf();
    }
}

void CodeGenerator::compileAssignment(const Expression& expression) {
    if (const auto* variable = std::get_if<VariableExpression>(&expression.node)) {
        static_cast<void>(add(namedInstruction(InstructionKind::StoreLocal, variable->identifier)));
    }
    else if (const auto* list = std::get_if<ListExpression>(&expression.node)) {
        pushSpan(expression.span);
        static_cast<void>(add(countInstruction(InstructionKind::UnpackList, list->items.size())));
        for (const auto& item : list->items) compileAssignment(*item);
        popSpan();
    }
    else if (const auto* attribute = std::get_if<AttributeExpression>(&expression.node)) {
        pushSpan(expression.span);
        compileExpression(*attribute->target);
        static_cast<void>(add(namedInstruction(InstructionKind::SetAttr, attribute->name)));
    }
}

void CodeGenerator::compileExpression(const Expression& expression) {
    if (auto constant = constantValueOf(expression)) {
        setLineFromSpan(expression.span);
        static_cast<void>(add(constantInstruction(std::move(*constant))));
        return;
    }
    if (const auto* variable = std::get_if<VariableExpression>(&expression.node)) {
        setLineFromSpan(expression.span);
        static_cast<void>(add(namedInstruction(InstructionKind::Lookup, variable->identifier)));
    }
    else if (const auto* slice = std::get_if<SliceExpression>(&expression.node)) {
        pushSpan(expression.span);
        compileExpression(*slice->target);
        for (const ExpressionPointer* part : {&slice->start, &slice->stop, &slice->step}) {
            if (*part) compileExpression(**part);
            else static_cast<void>(add(constantInstruction(Value::none())));
        }
        static_cast<void>(add(instruction(InstructionKind::Slice)));
        popSpan();
    }
    else if (const auto* unary = std::get_if<UnaryExpression>(&expression.node)) {
        setLineFromSpan(expression.span);
        if (unary->kind == UnaryOperatorKind::Not) {
            compileExpression(*unary->operand);
            static_cast<void>(add(instruction(InstructionKind::Not)));
        }
        else {
            if (const auto* operandConstant = std::get_if<ConstantExpression>(&unary->operand->node)) {
                try {
                    Value negated = negateValue(operandConstant->value);
                    static_cast<void>(add(constantInstruction(std::move(negated))));
                    return;
                }
                catch (const TemplateError&) {
                }
            }
            compileExpression(*unary->operand);
            static_cast<void>(addWithSpan(instruction(InstructionKind::Neg), expression.span));
        }
    }
    else if (const auto* binary = std::get_if<BinaryExpression>(&expression.node)) {
        compileBinaryOperation(*binary, expression.span);
    }
    else if (const auto* conditional = std::get_if<ConditionalExpression>(&expression.node)) {
        setLineFromSpan(expression.span);
        compileExpression(*conditional->test);
        startIf();
        compileExpression(*conditional->whenTrue);
        startElse();
        if (conditional->whenFalse) compileExpression(*conditional->whenFalse);
        else static_cast<void>(add(constantInstruction(Value::silentUndefined())));
        endIf();
    }
    else if (const auto* filter = std::get_if<FilterExpression>(&expression.node)) {
        pushSpan(expression.span);
        if (filter->operand) compileExpression(*filter->operand);
        const auto argumentCount = compileCallArguments(filter->arguments, 1, nullptr, TemplateSpan{});
        Instruction apply = namedInstruction(InstructionKind::ApplyFilter, filter->name);
        apply.optionalCount = argumentCount;
        apply.flags = filterLocalId(filter->name);
        static_cast<void>(add(std::move(apply)));
        popSpan();
    }
    else if (const auto* test = std::get_if<TestExpression>(&expression.node)) {
        pushSpan(expression.span);
        compileExpression(*test->operand);
        const auto argumentCount = compileCallArguments(test->arguments, 1, nullptr, TemplateSpan{});
        Instruction perform = namedInstruction(InstructionKind::PerformTest, test->name);
        perform.optionalCount = argumentCount;
        perform.flags = testLocalId(test->name);
        static_cast<void>(add(std::move(perform)));
        popSpan();
    }
    else if (const auto* attribute = std::get_if<AttributeExpression>(&expression.node)) {
        pushSpan(expression.span);
        compileExpression(*attribute->target);
        static_cast<void>(add(namedInstruction(InstructionKind::GetAttr, attribute->name)));
        popSpan();
    }
    else if (const auto* item = std::get_if<ItemExpression>(&expression.node)) {
        pushSpan(expression.span);
        compileExpression(*item->target);
        compileExpression(*item->subscript);
        static_cast<void>(add(instruction(InstructionKind::GetItem)));
        popSpan();
    }
    else if (std::holds_alternative<CallExpression>(expression.node)) {
        compileCall(expression, nullptr, TemplateSpan{});
    }
    else if (const auto* list = std::get_if<ListExpression>(&expression.node)) {
        setLineFromSpan(expression.span);
        for (const auto& element : list->items) compileExpression(*element);
        Instruction build = instruction(InstructionKind::BuildList);
        build.optionalCount = list->items.size();
        static_cast<void>(add(std::move(build)));
    }
    else if (const auto* map = std::get_if<MapExpression>(&expression.node)) {
        setLineFromSpan(expression.span);
        for (std::size_t index = 0; index < map->keys.size(); ++index) {
            compileExpression(*map->keys[index]);
            compileExpression(*map->values[index]);
        }
        static_cast<void>(add(countInstruction(InstructionKind::BuildMap, map->keys.size())));
    }
}

void CodeGenerator::compileCall(const Expression& callExpression, const MacroStatement* caller, TemplateSpan callerSpan) {
    const auto& call = std::get<CallExpression>(callExpression.node);
    pushSpan(callExpression.span);
    if (const auto* function = std::get_if<VariableExpression>(&call.target->node)) {
        const auto argumentCount = compileCallArguments(call.arguments, 0, caller, callerSpan);
        Instruction invoke = namedInstruction(InstructionKind::CallFunction, function->identifier);
        invoke.optionalCount = argumentCount;
        static_cast<void>(add(std::move(invoke)));
    }
    else if (const auto* attribute = std::get_if<AttributeExpression>(&call.target->node)) {
        const auto* self = std::get_if<VariableExpression>(&attribute->target->node);
        if (self != nullptr && self->identifier == "self") {
            Instruction begin = instruction(InstructionKind::BeginCapture);
            begin.captureMode = CaptureMode::Capture;
            static_cast<void>(add(std::move(begin)));
            static_cast<void>(add(namedInstruction(InstructionKind::CallBlock, attribute->name)));
            static_cast<void>(add(instruction(InstructionKind::EndCapture)));
        }
        else {
            compileExpression(*attribute->target);
            const auto argumentCount = compileCallArguments(call.arguments, 1, caller, callerSpan);
            Instruction invoke = namedInstruction(InstructionKind::CallMethod, attribute->name);
            invoke.optionalCount = argumentCount;
            static_cast<void>(add(std::move(invoke)));
        }
    }
    else {
        compileExpression(*call.target);
        const auto argumentCount = compileCallArguments(call.arguments, 1, caller, callerSpan);
        Instruction invoke = instruction(InstructionKind::CallObject);
        invoke.optionalCount = argumentCount;
        static_cast<void>(add(std::move(invoke)));
    }
    popSpan();
}

std::optional<std::size_t> CodeGenerator::compileCallArguments(std::span<const CallArgument> arguments, std::size_t extraArguments,
    const MacroStatement* caller, TemplateSpan callerSpan) {
    std::size_t pendingArguments = extraArguments;
    std::size_t argumentBatches = 0;
    bool hasKeywords = caller != nullptr;
    bool staticKeywords = caller == nullptr;
    for (const auto& argument : arguments) {
        switch (argument.kind) {
        case CallArgumentKind::Positional:
            compileExpression(*argument.value);
            ++pendingArguments;
            break;
        case CallArgumentKind::PositionalSplat:
            if (pendingArguments > 0) {
                Instruction build = instruction(InstructionKind::BuildList);
                build.optionalCount = pendingArguments;
                static_cast<void>(add(std::move(build)));
                pendingArguments = 0;
                ++argumentBatches;
            }
            compileExpression(*argument.value);
            ++argumentBatches;
            break;
        case CallArgumentKind::Keyword:
            if (!std::holds_alternative<ConstantExpression>(argument.value->node)) staticKeywords = false;
            hasKeywords = true;
            break;
        case CallArgumentKind::KeywordSplat:
            staticKeywords = false;
            hasKeywords = true;
            break;
        }
    }
    if (hasKeywords) {
        std::size_t pendingKeywords = 0;
        std::size_t keywordBatches = 0;
        ValueMap collected;
        for (const auto& argument : arguments) {
            if (argument.kind == CallArgumentKind::Keyword) {
                if (staticKeywords) {
                    collected.insert(Value::fromString(argument.name), std::get<ConstantExpression>(argument.value->node).value);
                }
                else {
                    static_cast<void>(add(constantInstruction(Value::fromString(argument.name))));
                    compileExpression(*argument.value);
                    ++pendingKeywords;
                }
            }
            else if (argument.kind == CallArgumentKind::KeywordSplat) {
                if (pendingKeywords > 0) {
                    static_cast<void>(add(countInstruction(InstructionKind::BuildKwargs, pendingKeywords)));
                    ++keywordBatches;
                    pendingKeywords = 0;
                }
                compileExpression(*argument.value);
                ++keywordBatches;
            }
        }
        if (!collected.empty()) {
            static_cast<void>(add(constantInstruction(KeywordArguments::wrap(std::move(collected)))));
        }
        else {
            if (caller != nullptr) {
                static_cast<void>(add(constantInstruction(Value::fromString("caller"))));
                compileMacroExpression(*caller, callerSpan);
                ++pendingKeywords;
            }
            if (keywordBatches > 0) {
                if (pendingKeywords > 0) {
                    static_cast<void>(add(countInstruction(InstructionKind::BuildKwargs, pendingKeywords)));
                    ++keywordBatches;
                }
                static_cast<void>(add(countInstruction(InstructionKind::MergeKwargs, keywordBatches)));
            }
            else {
                static_cast<void>(add(countInstruction(InstructionKind::BuildKwargs, pendingKeywords)));
            }
        }
        ++pendingArguments;
    }
    if (argumentBatches > 0) {
        if (pendingArguments > 0) {
            Instruction build = instruction(InstructionKind::BuildList);
            build.optionalCount = pendingArguments;
            static_cast<void>(add(std::move(build)));
            ++argumentBatches;
        }
        static_cast<void>(add(countInstruction(InstructionKind::UnpackLists, argumentBatches)));
        return std::nullopt;
    }
    return pendingArguments;
}

void CodeGenerator::compileBinaryOperation(const BinaryExpression& expression, TemplateSpan span) {
    pushSpan(span);
    InstructionKind kind = InstructionKind::Eq;
    switch (expression.kind) {
    case BinaryOperatorKind::Equal: kind = InstructionKind::Eq; break;
    case BinaryOperatorKind::NotEqual: kind = InstructionKind::Ne; break;
    case BinaryOperatorKind::Less: kind = InstructionKind::Lt; break;
    case BinaryOperatorKind::LessEqual: kind = InstructionKind::Lte; break;
    case BinaryOperatorKind::Greater: kind = InstructionKind::Gt; break;
    case BinaryOperatorKind::GreaterEqual: kind = InstructionKind::Gte; break;
    case BinaryOperatorKind::ShortCircuitAnd:
    case BinaryOperatorKind::ShortCircuitOr:
        startShortCircuit();
        compileExpression(*expression.left);
        shortCircuit(expression.kind == BinaryOperatorKind::ShortCircuitAnd);
        compileExpression(*expression.right);
        endShortCircuit();
        popSpan();
        return;
    case BinaryOperatorKind::Add: kind = InstructionKind::Add; break;
    case BinaryOperatorKind::Subtract: kind = InstructionKind::Sub; break;
    case BinaryOperatorKind::Multiply: kind = InstructionKind::Mul; break;
    case BinaryOperatorKind::Divide: kind = InstructionKind::Div; break;
    case BinaryOperatorKind::FloorDivide: kind = InstructionKind::IntDiv; break;
    case BinaryOperatorKind::Remainder: kind = InstructionKind::Rem; break;
    case BinaryOperatorKind::Power: kind = InstructionKind::Pow; break;
    case BinaryOperatorKind::Concatenate: kind = InstructionKind::StringConcat; break;
    case BinaryOperatorKind::In: kind = InstructionKind::In; break;
    }
    compileExpression(*expression.left);
    compileExpression(*expression.right);
    static_cast<void>(add(instruction(kind)));
    popSpan();
}

std::uint8_t CodeGenerator::filterLocalId(const std::string& name) {
    return localId(filterLocalIds_, name);
}

std::uint8_t CodeGenerator::testLocalId(const std::string& name) {
    return localId(testLocalIds_, name);
}

CompiledInstructions CodeGenerator::finish() {
    return CompiledInstructions{std::move(instructions_), std::move(blocks_), rawTemplateBytes_ == 0 ? 1 : nextPowerOfTwo(rawTemplateBytes_ * 2)};
}

}
