#include "chat_template/template_meta.h"

#include <algorithm>
#include <optional>
#include <set>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

#include "chat_template/template_ast.h"

namespace eversoul::native::chat_template {
namespace {

class AssignmentTracker {
public:
    explicit AssignmentTracker(bool trackNested) {
        if (trackNested) nestedOut_.emplace();
        assigned_.emplace_back();
    }

    void visitMacro(const MacroStatement& macro, bool declareCaller) {
        if (declareCaller) assign("caller");
        for (const auto& argument : macro.arguments) trackAssign(*argument);
        for (const auto& fallback : macro.defaults) visitExpression(*fallback);
        for (const auto& statement : macro.body) walk(statement);
    }

    void walk(const Statement& statement) {
        std::visit([this](const auto& node) { walkNode(node); }, statement.node);
    }

    [[nodiscard]] std::set<std::string> result() const {
        if (nestedOut_) return *nestedOut_;
        return out_;
    }

    [[nodiscard]] const std::set<std::string>& out() const noexcept { return out_; }

private:
    [[nodiscard]] bool isAssigned(std::string_view name) const {
        return std::ranges::any_of(assigned_, [name](const std::set<std::string, std::less<>>& scope) { return scope.contains(name); });
    }

    void assign(std::string_view name) { assigned_.back().emplace(name); }
    void assignNested(std::string name) {
        if (nestedOut_) nestedOut_->insert(std::move(name));
    }
    void push() { assigned_.emplace_back(); }
    void pop() { assigned_.pop_back(); }

    void visitOptional(const ExpressionPointer& expression) {
        if (expression) visitExpression(*expression);
    }

    void visitArgument(const CallArgument& argument) {
        visitExpression(*argument.value);
    }

    void visitExpression(const Expression& expression) {
        if (const auto* variable = std::get_if<VariableExpression>(&expression.node)) {
            if (!isAssigned(variable->identifier)) {
                out_.insert(variable->identifier);
                if (!nestedOut_) assign(variable->identifier);
                else assignNested(variable->identifier);
            }
            return;
        }
        if (std::holds_alternative<ConstantExpression>(expression.node)) return;
        if (const auto* unary = std::get_if<UnaryExpression>(&expression.node)) {
            visitExpression(*unary->operand);
            return;
        }
        if (const auto* binary = std::get_if<BinaryExpression>(&expression.node)) {
            visitExpression(*binary->left);
            visitExpression(*binary->right);
            return;
        }
        if (const auto* conditional = std::get_if<ConditionalExpression>(&expression.node)) {
            visitExpression(*conditional->test);
            visitExpression(*conditional->whenTrue);
            visitOptional(conditional->whenFalse);
            return;
        }
        if (const auto* filter = std::get_if<FilterExpression>(&expression.node)) {
            visitOptional(filter->operand);
            for (const auto& argument : filter->arguments) visitArgument(argument);
            return;
        }
        if (const auto* test = std::get_if<TestExpression>(&expression.node)) {
            visitExpression(*test->operand);
            for (const auto& argument : test->arguments) visitArgument(argument);
            return;
        }
        if (const auto* attribute = std::get_if<AttributeExpression>(&expression.node)) {
            if (nestedOut_) {
                std::vector<std::string_view> attributes{attribute->name};
                const Expression* pointer = attribute->target.get();
                for (;;) {
                    if (const auto* variable = std::get_if<VariableExpression>(&pointer->node)) {
                        if (!isAssigned(variable->identifier)) {
                            std::string path = variable->identifier;
                            for (auto name = attributes.rbegin(); name != attributes.rend(); ++name) {
                                path.push_back('.');
                                path.append(*name);
                            }
                            assignNested(std::move(path));
                            return;
                        }
                        break;
                    }
                    if (const auto* nested = std::get_if<AttributeExpression>(&pointer->node)) {
                        attributes.push_back(nested->name);
                        pointer = nested->target.get();
                        continue;
                    }
                    break;
                }
            }
            visitExpression(*attribute->target);
            return;
        }
        if (const auto* item = std::get_if<ItemExpression>(&expression.node)) {
            visitExpression(*item->target);
            visitExpression(*item->subscript);
            return;
        }
        if (const auto* slice = std::get_if<SliceExpression>(&expression.node)) {
            visitOptional(slice->start);
            visitOptional(slice->stop);
            visitOptional(slice->step);
            return;
        }
        if (const auto* call = std::get_if<CallExpression>(&expression.node)) {
            visitExpression(*call->target);
            for (const auto& argument : call->arguments) visitArgument(argument);
            return;
        }
        if (const auto* list = std::get_if<ListExpression>(&expression.node)) {
            for (const auto& item : list->items) visitExpression(*item);
            return;
        }
        if (const auto* map = std::get_if<MapExpression>(&expression.node)) {
            for (std::size_t index = 0; index < map->keys.size() && index < map->values.size(); ++index) {
                visitExpression(*map->keys[index]);
                visitExpression(*map->values[index]);
            }
        }
    }

    void trackAssign(const Expression& expression) {
        if (const auto* variable = std::get_if<VariableExpression>(&expression.node)) {
            assign(variable->identifier);
        }
        else if (const auto* list = std::get_if<ListExpression>(&expression.node)) {
            for (const auto& item : list->items) trackAssign(*item);
        }
    }

    void walkNode(const TemplateStatement& node) {
        assign("self");
        for (const auto& child : node.children) walk(child);
    }
    void walkNode(const EmitExpressionStatement& node) { visitExpression(*node.expression); }
    void walkNode(const EmitRawStatement&) {}
    void walkNode(const ForLoopStatement& node) {
        push();
        assign("loop");
        visitExpression(*node.iterable);
        trackAssign(*node.target);
        visitOptional(node.filter);
        for (const auto& child : node.body) walk(child);
        pop();
        push();
        for (const auto& child : node.elseBody) walk(child);
        pop();
    }
    void walkNode(const IfStatement& node) {
        visitExpression(*node.condition);
        push();
        for (const auto& child : node.trueBody) walk(child);
        pop();
        push();
        for (const auto& child : node.falseBody) walk(child);
        pop();
    }
    void walkNode(const WithStatement& node) {
        push();
        for (const auto& [target, expression] : node.assignments) {
            trackAssign(*target);
            visitExpression(*expression);
        }
        for (const auto& child : node.body) walk(child);
        pop();
    }
    void walkNode(const SetStatement& node) {
        trackAssign(*node.target);
        visitExpression(*node.expression);
    }
    void walkNode(const AutoEscapeStatement& node) {
        push();
        for (const auto& child : node.body) walk(child);
        pop();
    }
    void walkNode(const FilterBlockStatement& node) {
        push();
        for (const auto& child : node.body) walk(child);
        pop();
    }
    void walkNode(const SetBlockStatement& node) {
        trackAssign(*node.target);
        push();
        for (const auto& child : node.body) walk(child);
        pop();
    }
    void walkNode(const BlockStatement& node) {
        push();
        assign("super");
        for (const auto& child : node.body) walk(child);
        pop();
    }
    void walkNode(const ExtendsStatement&) {}
    void walkNode(const IncludeStatement&) {}
    void walkNode(const ImportStatement& node) { trackAssign(*node.name); }
    void walkNode(const FromImportStatement& node) {
        for (const auto& [name, alias] : node.names) trackAssign(alias ? *alias : *name);
    }
    void walkNode(const MacroStatement& node) {
        assign(node.name);
        push();
        visitMacro(node, true);
        pop();
    }
    void walkNode(const CallBlockStatement& node) {
        const auto& call = std::get<CallExpression>(node.call->node);
        visitExpression(*call.target);
        for (const auto& argument : call.arguments) visitArgument(argument);
        push();
        visitMacro(node.macroDeclaration, true);
        pop();
    }
    void walkNode(const DoStatement& node) {
        const auto& call = std::get<CallExpression>(node.call->node);
        visitExpression(*call.target);
        for (const auto& argument : call.arguments) visitArgument(argument);
    }

    std::set<std::string> out_;
    std::optional<std::set<std::string>> nestedOut_;
    std::vector<std::set<std::string, std::less<>>> assigned_;
};

}

std::set<std::string> findMacroClosure(const MacroStatement& macro) {
    AssignmentTracker tracker(false);
    tracker.visitMacro(macro, false);
    return tracker.out();
}

std::set<std::string> findUndeclaredVariables(const Statement& statement, bool trackNested) {
    AssignmentTracker tracker(trackNested);
    tracker.walk(statement);
    return tracker.result();
}

}
