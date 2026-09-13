#pragma once

#include <cstddef>
#include <functional>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "chat_template/template_codegen.h"
#include "chat_template/template_instructions.h"
#include "chat_template/template_lexer.h"
#include "chat_template/template_value.h"
#include "chat_template/template_vm.h"

namespace eversoul::native::chat_template {

using AutoEscapeCallback = std::function<AutoEscape(std::string_view)>;
using TemplateFormatter = std::function<void(TemplateOutput&, const TemplateState&, const Value&)>;

struct TemplateConfiguration {
    WhitespaceConfiguration whitespace;
    AutoEscapeCallback defaultAutoEscape;
};

struct CompiledTemplate {
    CompiledInstructions compiled;
    AutoEscape initialAutoEscape;
};

[[nodiscard]] std::shared_ptr<const CompiledTemplate> compileTemplate(std::string name, std::string source, const TemplateConfiguration& configuration);

class TemplateEnvironment;

class TemplateHandle {
public:
    TemplateHandle(const TemplateEnvironment& environment, std::shared_ptr<const CompiledTemplate> compiled, bool borrowed) noexcept;

    [[nodiscard]] std::string_view name() const noexcept;
    [[nodiscard]] std::string_view source() const noexcept;
    [[nodiscard]] std::string render(const Value& context) const;
    [[nodiscard]] std::set<std::string> undeclaredVariables(bool nested) const;
    [[nodiscard]] const CompiledTemplate& compiled() const noexcept { return *compiled_; }
    [[nodiscard]] bool borrowed() const noexcept { return borrowed_; }

private:
    const TemplateEnvironment* environment_;
    std::shared_ptr<const CompiledTemplate> compiled_;
    bool borrowed_;
};

class TemplateEnvironment {
public:
    [[nodiscard]] static TemplateEnvironment withDefaults();
    [[nodiscard]] static TemplateEnvironment emptyEnvironment();

    void addTemplate(std::string name, std::string source);
    [[nodiscard]] TemplateHandle getTemplate(std::string_view name) const;
    [[nodiscard]] TemplateHandle templateFromNamedString(std::string name, std::string source) const;
    [[nodiscard]] TemplateHandle templateFromString(std::string source) const;

    void setKeepTrailingNewline(bool enabled) noexcept { configuration_.whitespace.keepTrailingNewline = enabled; }
    void setTrimBlocks(bool enabled) noexcept { configuration_.whitespace.trimBlocks = enabled; }
    void setLstripBlocks(bool enabled) noexcept { configuration_.whitespace.lstripBlocks = enabled; }
    void setUndefinedBehavior(UndefinedBehavior behavior) noexcept { undefinedBehavior_ = behavior; }
    void setRecursionLimit(std::size_t level) noexcept;

    void addFilter(std::string name, Value filter);
    void addTest(std::string name, Value test);
    void addGlobal(std::string name, Value value);

    [[nodiscard]] std::optional<Value> global(std::string_view name) const;
    [[nodiscard]] const Value* filter(std::string_view name) const;
    [[nodiscard]] const Value* test(std::string_view name) const;
    [[nodiscard]] std::vector<std::pair<std::string, Value>> globals() const;
    [[nodiscard]] AutoEscape initialAutoEscape(std::string_view name) const;
    [[nodiscard]] UndefinedBehavior undefinedBehavior() const noexcept { return undefinedBehavior_; }
    [[nodiscard]] std::size_t recursionLimit() const noexcept { return recursionLimit_; }
    void format(const Value& value, const TemplateState& state, TemplateOutput& output) const;
    [[nodiscard]] std::string joinTemplatePath(std::string_view name, std::string_view parent) const;

private:
    TemplateEnvironment();

    std::map<std::string, std::shared_ptr<const CompiledTemplate>, std::less<>> templates_;
    TemplateConfiguration configuration_;
    std::map<std::string, Value, std::less<>> filters_;
    std::map<std::string, Value, std::less<>> tests_;
    std::map<std::string, Value, std::less<>> globals_;
    UndefinedBehavior undefinedBehavior_ = UndefinedBehavior::Lenient;
    TemplateFormatter formatter_;
    std::size_t recursionLimit_ = 500;
};

[[nodiscard]] AutoEscape defaultAutoEscapeForName(std::string_view name);
void writeEscapedValue(TemplateOutput& output, const AutoEscape& autoEscape, const Value& value);

}
