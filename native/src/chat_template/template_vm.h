#pragma once

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <map>
#include <memory>
#include <mutex>
#include <optional>
#include <set>
#include <span>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "chat_template/template_error.h"
#include "chat_template/template_instructions.h"
#include "chat_template/template_value.h"

namespace eversoul::native::chat_template {

class TemplateEnvironment;

enum class AutoEscapeKind { None, Html, Json, Custom };

struct AutoEscape {
    AutoEscapeKind kind = AutoEscapeKind::None;
    std::string customName;

    friend bool operator==(const AutoEscape&, const AutoEscape&) = default;
};

enum class UndefinedBehavior { Lenient, Chainable, SemiStrict, Strict };

class TemplateOutput {
public:
    explicit TemplateOutput(std::string& target) noexcept;
    [[nodiscard]] static TemplateOutput discarding();

    void beginCapture(CaptureMode mode);
    [[nodiscard]] Value endCapture(const AutoEscape& autoEscape);
    [[nodiscard]] bool isDiscarding() const noexcept;
    void write(std::string_view text);

private:
    TemplateOutput() noexcept = default;

    std::string* target_ = nullptr;
    std::vector<std::optional<std::string>> captureStack_;
};

class ClosureObject final : public TemplateObject {
public:
    void store(std::string_view key, Value value);
    void storeIfMissing(std::string_view key, const std::function<Value()>& factory);
    void clear();
    [[nodiscard]] std::optional<Value> getValue(const Value& key) const override;
    [[nodiscard]] ObjectEnumerator enumerate() const override;
    void writeDebug(text_format::DebugWriter& writer) const override;

private:
    mutable std::mutex mutex_;
    std::map<std::string, Value, std::less<>> values_;
};

class ClosureTracker {
public:
    ClosureTracker() = default;
    ClosureTracker(const ClosureTracker&) = delete;
    ClosureTracker& operator=(const ClosureTracker&) = delete;
    ~ClosureTracker();
    void track(std::shared_ptr<ClosureObject> closure);

private:
    std::mutex mutex_;
    std::vector<std::shared_ptr<ClosureObject>> closures_;
};

class NamespaceObject final : public TemplateObject {
public:
    void setValue(std::string_view key, Value value);
    [[nodiscard]] std::optional<Value> getValue(const Value& key) const override;
    [[nodiscard]] ObjectEnumerator enumerate() const override;
    void writeDebug(text_format::DebugWriter& writer) const override;

private:
    mutable std::mutex mutex_;
    std::map<std::string, Value, std::less<>> values_;
};

class ModuleObject final : public TemplateObject {
public:
    ModuleObject(ValueMap values, Value captured) noexcept;
    [[nodiscard]] std::optional<Value> getValue(const Value& key) const override;
    [[nodiscard]] ObjectEnumerator enumerate() const override;
    void render(text_format::DebugWriter& writer) const override;
    void writeDebug(text_format::DebugWriter& writer) const override;

private:
    ValueMap values_;
    Value captured_;
};

class LoopObject final : public TemplateObject {
public:
    LoopObject(ValueIteratorPointer iterator, std::optional<std::size_t> length, std::size_t depth, std::optional<std::uint32_t> recurseJumpTarget);

    [[nodiscard]] Value call(const TemplateState& state, std::span<const Value> arguments) const override;
    [[nodiscard]] Value callMethod(const TemplateState& state, std::string_view name, std::span<const Value> arguments) const override;
    [[nodiscard]] ObjectEnumerator enumerate() const override;
    [[nodiscard]] std::optional<Value> getValue(const Value& key) const override;
    void render(text_format::DebugWriter& writer) const override;
    void writeDebug(text_format::DebugWriter& writer) const override;

    [[nodiscard]] std::optional<Value> nextItem();
    [[nodiscard]] bool didNotIterate() const noexcept;
    [[nodiscard]] std::size_t depth() const noexcept { return depth_; }
    [[nodiscard]] const std::optional<std::uint32_t>& recurseJumpTarget() const noexcept { return recurseJumpTarget_; }

private:
    std::optional<std::size_t> length_;
    std::atomic<std::size_t> index_;
    std::size_t depth_;
    std::optional<std::uint32_t> recurseJumpTarget_;
    mutable std::mutex mutex_;
    mutable std::optional<std::vector<Value>> lastChangedValue_;
    mutable ValueIteratorPointer iterator_;
    mutable std::optional<Value> previousItem_;
    mutable std::optional<Value> currentItem_;
    mutable std::optional<Value> nextItem_;
};

struct LoopState {
    bool withLoopVariable = false;
    std::optional<std::pair<std::uint32_t, bool>> currentRecursionJump;
    std::shared_ptr<LoopObject> object;
};

struct Frame {
    std::map<std::string, Value, std::less<>> locals;
    Value context;
    std::optional<LoopState> currentLoop;
    std::shared_ptr<ClosureObject> closure;
};

class TemplateContext {
public:
    explicit TemplateContext(const TemplateEnvironment& environment);
    TemplateContext(const TemplateEnvironment& environment, Frame frame);

    [[nodiscard]] const TemplateEnvironment& environment() const noexcept { return *environment_; }
    void store(std::string_view key, Value value);
    void enclose(std::string_view key);
    [[nodiscard]] std::shared_ptr<ClosureObject> closure() const;
    [[nodiscard]] std::shared_ptr<ClosureObject> takeClosure();
    void resetClosure(std::shared_ptr<ClosureObject> closure);
    [[nodiscard]] Value cloneBase() const;
    [[nodiscard]] std::optional<Value> load(std::string_view key) const;
    [[nodiscard]] std::set<std::string> knownVariables(bool withGlobals) const;
    void pushFrame(Frame frame);
    Frame popFrame();
    [[nodiscard]] const std::map<std::string, Value, std::less<>>& exports() const;
    [[nodiscard]] std::map<std::string, Value, std::less<>>& currentLocals();
    [[nodiscard]] LoopState* currentLoop();
    [[nodiscard]] std::size_t depth() const noexcept;
    void incrementDepth(std::size_t delta);
    void decrementDepth(std::size_t delta) noexcept;

private:
    void checkDepth() const;

    const TemplateEnvironment* environment_;
    std::vector<Frame> stack_;
    std::size_t outerStackDepth_ = 0;
    std::size_t recursionLimit_;
};

class BlockStack {
public:
    BlockStack() = default;
    explicit BlockStack(const Instructions* instructions);
    [[nodiscard]] const Instructions* instructions() const noexcept;
    [[nodiscard]] bool push() noexcept;
    void pop();
    void appendInstructions(const Instructions* instructions);

private:
    std::vector<const Instructions*> instructions_;
    std::size_t depth_ = 0;
};

using MacroTable = std::vector<std::pair<const Instructions*, std::uint32_t>>;

class TemplateState {
public:
    TemplateState(TemplateContext context, AutoEscape autoEscape, const Instructions* instructions,
        std::map<std::string, BlockStack, std::less<>> blocks);

    [[nodiscard]] const TemplateEnvironment& environment() const noexcept { return context_.environment(); }
    [[nodiscard]] std::string_view name() const noexcept;
    [[nodiscard]] const AutoEscape& autoEscape() const noexcept { return autoEscape_; }
    [[nodiscard]] UndefinedBehavior undefinedBehavior() const noexcept;
    [[nodiscard]] std::optional<std::string_view> currentBlock() const noexcept;
    [[nodiscard]] std::optional<Value> lookup(std::string_view name) const;
    [[nodiscard]] std::vector<std::string> exports() const;
    [[nodiscard]] std::vector<std::string> knownVariables() const;
    [[nodiscard]] Value applyFilter(std::string_view filter, std::span<const Value> arguments) const;
    [[nodiscard]] bool performTest(std::string_view test, std::span<const Value> arguments) const;
    [[nodiscard]] std::string format(const Value& value) const;
    [[nodiscard]] std::optional<Value> getTemporary(std::string_view name) const;
    std::optional<Value> setTemporary(std::string_view name, Value value) const;
    [[nodiscard]] Value callMacro(std::string_view name, std::span<const Value> arguments) const;

    TemplateContext context_;
    std::optional<std::string> currentBlock_;
    AutoEscape autoEscape_;
    const Instructions* instructions_;
    std::shared_ptr<std::mutex> temporariesMutex_;
    std::shared_ptr<std::map<std::string, Value, std::less<>>> temporaries_;
    std::map<std::string, BlockStack, std::less<>> blocks_;
    std::set<std::string, std::less<>> loadedTemplates_;
    std::int64_t id_;
    std::shared_ptr<MacroTable> macros_;
    std::shared_ptr<ClosureTracker> closureTracker_;
};

class MacroObject final : public TemplateObject {
public:
    MacroObject(Value name, std::vector<Value> argumentSpecification, std::size_t macroReferenceId, std::int64_t stateId, Value closure,
        bool callerReference) noexcept;

    [[nodiscard]] ObjectEnumerator enumerate() const override;
    [[nodiscard]] std::optional<Value> getValue(const Value& key) const override;
    [[nodiscard]] Value call(const TemplateState& state, std::span<const Value> arguments) const override;
    void render(text_format::DebugWriter& writer) const override;
    void writeDebug(text_format::DebugWriter& writer) const override;

private:
    Value name_;
    std::vector<Value> argumentSpecification_;
    std::size_t macroReferenceId_;
    std::int64_t stateId_;
    Value closure_;
    bool callerReference_;
};

struct EvaluationResult {
    std::optional<Value> value;
    TemplateState state;
};

class TemplateVirtualMachine {
public:
    explicit TemplateVirtualMachine(const TemplateEnvironment& environment) noexcept : environment_(&environment) {}

    [[nodiscard]] EvaluationResult evaluate(const Instructions& instructions, Value root,
        const std::map<std::string, Instructions, std::less<>>& blocks, TemplateOutput& output, AutoEscape autoEscape) const;
    [[nodiscard]] std::optional<Value> evaluateMacro(const TemplateState& state, std::size_t macroId, TemplateOutput& output, Value closure,
        std::optional<Value> caller, std::vector<Value> arguments) const;
    [[nodiscard]] std::optional<Value> callBlock(std::string_view name, TemplateState& state, TemplateOutput& output) const;

private:
    [[nodiscard]] std::optional<Value> evaluateState(TemplateState& state, TemplateOutput& output) const;
    [[nodiscard]] std::optional<Value> run(TemplateState& state, TemplateOutput& output, std::vector<Value> stack, std::uint32_t pc) const;
    [[nodiscard]] Value mergeKeywordArguments(std::vector<Value> values) const;
    void performInclude(const Value& name, TemplateState& state, TemplateOutput& output, bool ignoreMissing) const;
    [[nodiscard]] Value performSuper(TemplateState& state, TemplateOutput& output, bool capture) const;
    [[nodiscard]] const Instructions* loadBlocks(const Value& name, TemplateState& state) const;
    [[nodiscard]] AutoEscape deriveAutoEscape(const Value& value, const AutoEscape& initial) const;
    void pushLoop(TemplateState& state, const Value& iterable, std::uint8_t flags, std::uint32_t pc,
        std::optional<std::pair<std::uint32_t, bool>> currentRecursionJump) const;

    const TemplateEnvironment* environment_;
};

[[nodiscard]] std::map<std::string, BlockStack, std::less<>> prepareBlocks(const std::map<std::string, Instructions, std::less<>>& blocks);

}
