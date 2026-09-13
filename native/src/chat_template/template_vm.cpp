#include "chat_template/template_vm.h"

#include <algorithm>
#include <array>
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

#include "chat_template/template_environment.h"
#include "chat_template/template_error.h"
#include "chat_template/template_instructions.h"
#include "chat_template/template_operations.h"
#include "chat_template/template_value.h"
#include "unicode/utf8_text.h"

namespace eversoul::native::chat_template {
namespace {

constexpr std::size_t kIncludeRecursionCost = 10;
constexpr std::size_t kMacroRecursionCost = 4;

std::atomic<std::int64_t> nextStateId{0};

Value handleUndefined(UndefinedBehavior behavior, bool parentWasUndefined) {
    if (behavior == UndefinedBehavior::Chainable || !parentWasUndefined) return Value::undefined();
    throw TemplateError(TemplateErrorKind::UndefinedError);
}

bool undefinedAwareTruth(UndefinedBehavior behavior, const Value& value) {
    if (behavior == UndefinedBehavior::Strict && value.isUndefined() && !value.isSilentUndefined()) {
        throw TemplateError(TemplateErrorKind::UndefinedError);
    }
    return value.isTrue();
}

void assertIterable(UndefinedBehavior behavior, const Value& value) {
    if ((behavior == UndefinedBehavior::Strict || behavior == UndefinedBehavior::SemiStrict) && value.isUndefined() && !value.isSilentUndefined()) {
        throw TemplateError(TemplateErrorKind::UndefinedError);
    }
}

void processError(TemplateError& error, std::uint32_t pc, const TemplateState& state) {
    if (error.line()) return;
    if (const auto span = state.instructions_->spanOf(pc)) {
        error.setFilenameAndSpan(state.instructions_->name(), *span);
    }
    else if (const auto line = state.instructions_->lineOf(pc)) {
        error.setFilenameAndLine(state.instructions_->name(), *line);
    }
}

std::span<const Value> callArguments(std::vector<Value>& stack, const std::optional<std::size_t>& count) {
    std::size_t size = 0;
    if (count) {
        size = *count;
    }
    else {
        const Value top = std::move(stack.back());
        stack.pop_back();
        size = top.asUsize().value_or(0);
    }
    return std::span<const Value>(stack.data() + (stack.size() - size), size);
}

Value popValue(std::vector<Value>& stack) {
    Value value = std::move(stack.back());
    stack.pop_back();
    return value;
}

void reverseTop(std::vector<Value>& stack, std::size_t count) {
    std::reverse(stack.end() - static_cast<std::ptrdiff_t>(count), stack.end());
}

void dropTop(std::vector<Value>& stack, std::size_t count) {
    stack.resize(stack.size() - count);
}

std::string debugString(const Value& value) {
    std::string output;
    text_format::DebugWriter writer(output, false);
    value.writeDebug(writer);
    return output;
}

}

TemplateOutput::TemplateOutput(std::string& target) noexcept : target_(&target) {}

TemplateOutput TemplateOutput::discarding() {
    TemplateOutput output;
    output.captureStack_.emplace_back(std::nullopt);
    return output;
}

void TemplateOutput::beginCapture(CaptureMode mode) {
    if (mode == CaptureMode::Capture) captureStack_.emplace_back(std::string{});
    else captureStack_.emplace_back(std::nullopt);
}

Value TemplateOutput::endCapture(const AutoEscape& autoEscape) {
    std::optional<std::string> captured = std::move(captureStack_.back());
    captureStack_.pop_back();
    if (!captured) return Value::undefined();
    if (autoEscape.kind != AutoEscapeKind::None) return Value::fromSafeString(std::move(*captured));
    return Value::fromString(*captured);
}

bool TemplateOutput::isDiscarding() const noexcept {
    return !captureStack_.empty() && !captureStack_.back().has_value();
}

void TemplateOutput::write(std::string_view text) {
    if (!captureStack_.empty()) {
        if (captureStack_.back()) captureStack_.back()->append(text);
        return;
    }
    if (target_ != nullptr) target_->append(text);
}

void ClosureObject::store(std::string_view key, Value value) {
    std::scoped_lock lock(mutex_);
    values_.insert_or_assign(std::string(key), std::move(value));
}

void ClosureObject::storeIfMissing(std::string_view key, const std::function<Value()>& factory) {
    std::scoped_lock lock(mutex_);
    if (!values_.contains(key)) values_.emplace(std::string(key), factory());
}

void ClosureObject::clear() {
    std::map<std::string, Value, std::less<>> released;
    {
        std::scoped_lock lock(mutex_);
        released.swap(values_);
    }
}

std::optional<Value> ClosureObject::getValue(const Value& key) const {
    const auto name = key.asString();
    if (!name) return std::nullopt;
    std::scoped_lock lock(mutex_);
    const auto found = values_.find(*name);
    if (found == values_.end()) return std::nullopt;
    return found->second;
}

ObjectEnumerator ClosureObject::enumerate() const {
    std::vector<Value> keys;
    {
        std::scoped_lock lock(mutex_);
        for (const auto& entry : values_) keys.push_back(Value::fromString(entry.first));
    }
    return ObjectEnumerator::values(std::move(keys));
}

void ClosureObject::writeDebug(text_format::DebugWriter& writer) const {
    std::vector<std::pair<std::string, Value>> entries;
    {
        std::scoped_lock lock(mutex_);
        entries.assign(values_.begin(), values_.end());
    }
    writer.writeStruct("Closure", 1, [](std::size_t) { return std::string_view("values"); }, [&entries](std::size_t, text_format::DebugWriter& field) {
        field.writeStruct("Mutex", 3, [](std::size_t index) {
            constexpr std::array<std::string_view, 3> names{"data", "poisoned", ".."};
            return names[index];
        }, [&entries](std::size_t index, text_format::DebugWriter& part) {
            if (index == 0) {
                part.writeMap(entries.size(),
                    [&entries](std::size_t entry, text_format::DebugWriter& key) { key.write(unicode::debugEscapedString(entries[entry].first)); },
                    [&entries](std::size_t entry, text_format::DebugWriter& value) { entries[entry].second.writeDebug(value); });
            }
            else if (index == 1) {
                part.write("false");
            }
        });
    });
}

ClosureTracker::~ClosureTracker() {
    std::vector<std::shared_ptr<ClosureObject>> closures;
    {
        std::scoped_lock lock(mutex_);
        closures.swap(closures_);
    }
    for (const auto& closure : closures) closure->clear();
}

void ClosureTracker::track(std::shared_ptr<ClosureObject> closure) {
    std::scoped_lock lock(mutex_);
    closures_.push_back(std::move(closure));
}

void NamespaceObject::setValue(std::string_view key, Value value) {
    std::scoped_lock lock(mutex_);
    values_.insert_or_assign(std::string(key), std::move(value));
}

std::optional<Value> NamespaceObject::getValue(const Value& key) const {
    const auto name = key.asString();
    if (!name) return std::nullopt;
    std::scoped_lock lock(mutex_);
    const auto found = values_.find(*name);
    if (found == values_.end()) return std::nullopt;
    return found->second;
}

ObjectEnumerator NamespaceObject::enumerate() const {
    std::vector<Value> keys;
    {
        std::scoped_lock lock(mutex_);
        for (const auto& entry : values_) keys.push_back(Value::fromString(entry.first));
    }
    return ObjectEnumerator::values(std::move(keys));
}

void NamespaceObject::writeDebug(text_format::DebugWriter& writer) const {
    std::vector<std::pair<std::string, Value>> entries;
    {
        std::scoped_lock lock(mutex_);
        entries.assign(values_.begin(), values_.end());
    }
    writer.writeStruct("Namespace", 1, [](std::size_t) { return std::string_view("data"); }, [&entries](std::size_t, text_format::DebugWriter& field) {
        field.writeStruct("Mutex", 3, [](std::size_t index) {
            constexpr std::array<std::string_view, 3> names{"data", "poisoned", ".."};
            return names[index];
        }, [&entries](std::size_t index, text_format::DebugWriter& part) {
            if (index == 0) {
                part.writeMap(entries.size(),
                    [&entries](std::size_t entry, text_format::DebugWriter& key) { key.write(unicode::debugEscapedString(entries[entry].first)); },
                    [&entries](std::size_t entry, text_format::DebugWriter& value) { entries[entry].second.writeDebug(value); });
            }
            else if (index == 1) {
                part.write("false");
            }
        });
    });
}

ModuleObject::ModuleObject(ValueMap values, Value captured) noexcept : values_(std::move(values)), captured_(std::move(captured)) {}

std::optional<Value> ModuleObject::getValue(const Value& key) const {
    if (const Value* value = values_.find(key)) return *value;
    return std::nullopt;
}

ObjectEnumerator ModuleObject::enumerate() const {
    std::vector<Value> keys;
    for (const auto& entry : values_.entries()) keys.push_back(entry.first);
    return ObjectEnumerator::values(std::move(keys));
}

void ModuleObject::render(text_format::DebugWriter& writer) const {
    text_format::DebugWriter plain = writer.withAlternate(false);
    captured_.writeDisplay(plain);
}

void ModuleObject::writeDebug(text_format::DebugWriter& writer) const {
    const auto& entries = values_.entries();
    writer.writeStruct("Module", 2, [](std::size_t index) { return index == 0 ? std::string_view("values") : std::string_view("captured"); },
        [&entries, this](std::size_t index, text_format::DebugWriter& field) {
            if (index == 0) {
                field.writeMap(entries.size(),
                    [&entries](std::size_t entry, text_format::DebugWriter& key) { entries[entry].first.writeDebug(key); },
                    [&entries](std::size_t entry, text_format::DebugWriter& value) { entries[entry].second.writeDebug(value); });
            }
            else {
                captured_.writeDebug(field);
            }
        });
}

LoopObject::LoopObject(ValueIteratorPointer iterator, std::optional<std::size_t> length, std::size_t depth, std::optional<std::uint32_t> recurseJumpTarget)
    : length_(length), index_(SIZE_MAX), depth_(depth), recurseJumpTarget_(recurseJumpTarget), iterator_(std::move(iterator)) {}

Value LoopObject::call(const TemplateState&, std::span<const Value>) const {
    throw TemplateError(TemplateErrorKind::InvalidOperation, "loop recursion cannot be called this way");
}

Value LoopObject::callMethod(const TemplateState&, std::string_view name, std::span<const Value> arguments) const {
    if (name == "changed") {
        std::scoped_lock lock(mutex_);
        std::vector<Value> value(arguments.begin(), arguments.end());
        const bool changed = !lastChangedValue_ || !std::ranges::equal(*lastChangedValue_, value);
        if (changed) {
            lastChangedValue_ = std::move(value);
            return Value::fromBool(true);
        }
        return Value::fromBool(false);
    }
    if (name == "cycle") {
        if (arguments.empty()) throw TemplateError(TemplateErrorKind::InvalidOperation, "attempt to calculate the remainder with a divisor of zero");
        const std::size_t index = index_.load(std::memory_order_relaxed);
        return arguments[index % arguments.size()];
    }
    throw TemplateError(TemplateErrorKind::UnknownMethod);
}

ObjectEnumerator LoopObject::enumerate() const {
    return ObjectEnumerator::strings({"index0", "index", "length", "revindex", "revindex0", "first", "last", "depth", "depth0", "previtem", "nextitem"});
}

std::optional<Value> LoopObject::getValue(const Value& key) const {
    const auto name = key.asString();
    if (!name) return std::nullopt;
    const std::uint64_t index = index_.load(std::memory_order_relaxed);
    if (index == SIZE_MAX) return Value::undefined();
    if (*name == "index0") return Value::fromUInt64(index);
    if (*name == "index") return Value::fromUInt64(index + 1);
    if (*name == "length") return length_ ? Value::fromUInt64(*length_) : Value::undefined();
    if (*name == "revindex") return length_ ? Value::fromUInt64(*length_ > index ? *length_ - index : 0) : Value::undefined();
    if (*name == "revindex0") {
        if (!length_) return Value::undefined();
        const std::uint64_t remaining = *length_ > index ? *length_ - index : 0;
        return Value::fromUInt64(remaining > 0 ? remaining - 1 : 0);
    }
    if (*name == "first") return Value::fromBool(index == 0);
    if (*name == "last") return length_ ? Value::fromBool(*length_ == 0 || index == *length_ - 1) : Value::fromBool(false);
    if (*name == "depth") return Value::fromUInt64(depth_ + 1);
    if (*name == "depth0") return Value::fromUInt64(depth_);
    if (*name == "previtem") {
        std::scoped_lock lock(mutex_);
        return previousItem_.value_or(Value::undefined());
    }
    if (*name == "nextitem") {
        std::scoped_lock lock(mutex_);
        if (nextItem_) return *nextItem_;
        nextItem_ = iterator_->next();
        return nextItem_.value_or(Value::undefined());
    }
    return std::nullopt;
}

void LoopObject::render(text_format::DebugWriter& writer) const {
    writer.write("<loop " + std::to_string(index_.load(std::memory_order_relaxed)) + "/" + (length_ ? std::to_string(*length_) : std::string("?")) + ">");
}

void LoopObject::writeDebug(text_format::DebugWriter& writer) const {
    writer.writeStruct("Loop", 3, [](std::size_t index) {
        constexpr std::array<std::string_view, 3> names{"len", "idx", "depth"};
        return names[index];
    }, [this](std::size_t index, text_format::DebugWriter& field) {
        if (index == 0) {
            if (length_) field.writeTuple("Some", 1, [this](std::size_t, text_format::DebugWriter& inner) { inner.write(std::to_string(*length_)); });
            else field.write("None");
        }
        else if (index == 1) {
            field.write(std::to_string(index_.load(std::memory_order_relaxed)));
        }
        else {
            field.write(std::to_string(depth_));
        }
    });
}

std::optional<Value> LoopObject::nextItem() {
    index_.fetch_add(1, std::memory_order_relaxed);
    std::scoped_lock lock(mutex_);
    previousItem_ = std::move(currentItem_);
    currentItem_.reset();
    if (nextItem_) {
        currentItem_ = std::move(nextItem_);
        nextItem_.reset();
    }
    else {
        currentItem_ = iterator_->next();
    }
    return currentItem_;
}

bool LoopObject::didNotIterate() const noexcept {
    return index_.load(std::memory_order_relaxed) == 0;
}

TemplateContext::TemplateContext(const TemplateEnvironment& environment)
    : environment_(&environment), recursionLimit_(environment.recursionLimit()) {
    stack_.reserve(32);
}

TemplateContext::TemplateContext(const TemplateEnvironment& environment, Frame frame) : TemplateContext(environment) {
    stack_.push_back(std::move(frame));
}

void TemplateContext::store(std::string_view key, Value value) {
    Frame& top = stack_.back();
    if (top.closure) top.closure->store(key, value);
    top.locals.insert_or_assign(std::string(key), std::move(value));
}

void TemplateContext::enclose(std::string_view key) {
    const std::shared_ptr<ClosureObject> closure = stack_.back().closure;
    closure->storeIfMissing(key, [this, key] { return load(key).value_or(Value::undefined()); });
}

std::shared_ptr<ClosureObject> TemplateContext::closure() const {
    return stack_.back().closure;
}

std::shared_ptr<ClosureObject> TemplateContext::takeClosure() {
    return std::exchange(stack_.back().closure, nullptr);
}

void TemplateContext::resetClosure(std::shared_ptr<ClosureObject> closure) {
    stack_.back().closure = std::move(closure);
}

Value TemplateContext::cloneBase() const {
    return stack_.empty() ? Value::undefined() : stack_.front().context;
}

std::optional<Value> TemplateContext::load(std::string_view key) const {
    for (auto frame = stack_.rbegin(); frame != stack_.rend(); ++frame) {
        if (const auto found = frame->locals.find(key); found != frame->locals.end()) return found->second;
        if (frame->currentLoop && frame->currentLoop->withLoopVariable && key == "loop") return Value::fromObject(frame->currentLoop->object);
        if (auto value = frame->context.getAttributeFast(key)) return value;
    }
    return environment_->global(key);
}

std::set<std::string> TemplateContext::knownVariables(bool withGlobals) const {
    std::set<std::string> seen;
    for (auto frame = stack_.rbegin(); frame != stack_.rend(); ++frame) {
        for (const auto& entry : frame->locals) seen.insert(entry.first);
        if (frame->currentLoop && frame->currentLoop->withLoopVariable) seen.insert("loop");
        try {
            auto iterator = frame->context.tryIterate();
            while (auto key = iterator->next()) {
                const auto name = key->asString();
                if (!name) continue;
                try {
                    static_cast<void>(frame->context.getItem(*key));
                    seen.insert(std::string(*name));
                }
                catch (const TemplateError&) {
                }
            }
        }
        catch (const TemplateError&) {
        }
    }
    if (withGlobals) {
        for (const auto& [name, value] : environment_->globals()) seen.insert(name);
    }
    return seen;
}

void TemplateContext::pushFrame(Frame frame) {
    checkDepth();
    stack_.push_back(std::move(frame));
}

Frame TemplateContext::popFrame() {
    Frame frame = std::move(stack_.back());
    stack_.pop_back();
    return frame;
}

const std::map<std::string, Value, std::less<>>& TemplateContext::exports() const {
    return stack_.front().locals;
}

std::map<std::string, Value, std::less<>>& TemplateContext::currentLocals() {
    return stack_.back().locals;
}

LoopState* TemplateContext::currentLoop() {
    for (auto frame = stack_.rbegin(); frame != stack_.rend(); ++frame) {
        if (frame->currentLoop) return &*frame->currentLoop;
    }
    return nullptr;
}

std::size_t TemplateContext::depth() const noexcept {
    return outerStackDepth_ + stack_.size();
}

void TemplateContext::incrementDepth(std::size_t delta) {
    outerStackDepth_ += delta;
    checkDepth();
}

void TemplateContext::decrementDepth(std::size_t delta) noexcept {
    outerStackDepth_ -= delta;
}

void TemplateContext::checkDepth() const {
    if (depth() > recursionLimit_) throw TemplateError(TemplateErrorKind::InvalidOperation, "recursion limit exceeded");
}

BlockStack::BlockStack(const Instructions* instructions) : instructions_{instructions} {}

const Instructions* BlockStack::instructions() const noexcept {
    return instructions_[depth_];
}

bool BlockStack::push() noexcept {
    if (depth_ + 1 < instructions_.size()) {
        ++depth_;
        return true;
    }
    return false;
}

void BlockStack::pop() {
    if (depth_ == 0) throw TemplateError(TemplateErrorKind::InvalidOperation, "attempt to subtract with overflow");
    --depth_;
}

void BlockStack::appendInstructions(const Instructions* instructions) {
    instructions_.push_back(instructions);
}

std::map<std::string, BlockStack, std::less<>> prepareBlocks(const std::map<std::string, Instructions, std::less<>>& blocks) {
    std::map<std::string, BlockStack, std::less<>> prepared;
    for (const auto& [name, instructions] : blocks) prepared.emplace(name, BlockStack(&instructions));
    return prepared;
}

TemplateState::TemplateState(TemplateContext context, AutoEscape autoEscape, const Instructions* instructions,
    std::map<std::string, BlockStack, std::less<>> blocks)
    : context_(std::move(context)),
      autoEscape_(std::move(autoEscape)),
      instructions_(instructions),
      temporariesMutex_(std::make_shared<std::mutex>()),
      temporaries_(std::make_shared<std::map<std::string, Value, std::less<>>>()),
      blocks_(std::move(blocks)),
      id_(nextStateId.fetch_add(1, std::memory_order_relaxed)),
      macros_(std::make_shared<MacroTable>()),
      closureTracker_(std::make_shared<ClosureTracker>()) {}

std::string_view TemplateState::name() const noexcept {
    return instructions_->name();
}

UndefinedBehavior TemplateState::undefinedBehavior() const noexcept {
    return environment().undefinedBehavior();
}

std::optional<std::string_view> TemplateState::currentBlock() const noexcept {
    if (currentBlock_) return std::string_view(*currentBlock_);
    return std::nullopt;
}

std::optional<Value> TemplateState::lookup(std::string_view name) const {
    return context_.load(name);
}

std::vector<std::string> TemplateState::exports() const {
    std::vector<std::string> names;
    for (const auto& entry : context_.exports()) names.push_back(entry.first);
    return names;
}

std::vector<std::string> TemplateState::knownVariables() const {
    const std::set<std::string> names = context_.knownVariables(true);
    return {names.begin(), names.end()};
}

Value TemplateState::applyFilter(std::string_view filter, std::span<const Value> arguments) const {
    const Value* function = environment().filter(filter);
    if (function == nullptr) throw TemplateError(TemplateErrorKind::UnknownFilter);
    return function->call(*this, arguments);
}

bool TemplateState::performTest(std::string_view test, std::span<const Value> arguments) const {
    const Value* function = environment().test(test);
    if (function == nullptr) throw TemplateError(TemplateErrorKind::UnknownTest);
    return function->call(*this, arguments).isTrue();
}

std::string TemplateState::format(const Value& value) const {
    std::string result;
    TemplateOutput output(result);
    environment().format(value, *this, output);
    return result;
}

std::optional<Value> TemplateState::getTemporary(std::string_view name) const {
    std::scoped_lock lock(*temporariesMutex_);
    const auto found = temporaries_->find(name);
    if (found == temporaries_->end()) return std::nullopt;
    return found->second;
}

std::optional<Value> TemplateState::setTemporary(std::string_view name, Value value) const {
    std::scoped_lock lock(*temporariesMutex_);
    auto found = temporaries_->find(name);
    if (found == temporaries_->end()) {
        temporaries_->emplace(std::string(name), std::move(value));
        return std::nullopt;
    }
    Value previous = std::exchange(found->second, std::move(value));
    return previous;
}

Value TemplateState::callMacro(std::string_view name, std::span<const Value> arguments) const {
    const auto function = lookup(name);
    if (!function) throw TemplateError(TemplateErrorKind::UnknownFunction, "macro not found");
    return Value::fromString(function->call(*this, arguments).toString());
}

MacroObject::MacroObject(Value name, std::vector<Value> argumentSpecification, std::size_t macroReferenceId, std::int64_t stateId, Value closure,
    bool callerReference) noexcept
    : name_(std::move(name)),
      argumentSpecification_(std::move(argumentSpecification)),
      macroReferenceId_(macroReferenceId),
      stateId_(stateId),
      closure_(std::move(closure)),
      callerReference_(callerReference) {}

ObjectEnumerator MacroObject::enumerate() const {
    return ObjectEnumerator::strings({"name", "arguments", "caller"});
}

std::optional<Value> MacroObject::getValue(const Value& key) const {
    const auto name = key.asString();
    if (!name) return std::nullopt;
    if (*name == "name") return name_;
    if (*name == "arguments") return Value::fromSequence(argumentSpecification_);
    if (*name == "caller") return Value::fromBool(callerReference_);
    return std::nullopt;
}

Value MacroObject::call(const TemplateState& state, std::span<const Value> arguments) const {
    if (state.id_ != stateId_) throw TemplateError(TemplateErrorKind::InvalidOperation, "cannot call this macro. template state went away.");
    std::optional<KeywordArguments> keywords;
    if (!arguments.empty()) {
        keywords = KeywordArguments::extract(arguments.back());
        if (keywords) arguments = arguments.first(arguments.size() - 1);
    }
    if (arguments.size() > argumentSpecification_.size()) throw TemplateError(TemplateErrorKind::TooManyArguments);
    std::set<std::string, std::less<>> keywordsUsed;
    std::vector<Value> argumentValues;
    argumentValues.reserve(argumentSpecification_.size());
    for (std::size_t index = 0; index < argumentSpecification_.size(); ++index) {
        const auto name = argumentSpecification_[index].asString();
        if (!name) {
            argumentValues.push_back(Value::undefined());
            continue;
        }
        const Value* keyword = keywords ? keywords->peek(*name) : nullptr;
        const bool hasPositional = index < arguments.size();
        if (hasPositional && keyword != nullptr) {
            throw TemplateError(TemplateErrorKind::TooManyArguments, "duplicate argument `" + std::string(*name) + "`");
        }
        if (hasPositional) {
            argumentValues.push_back(arguments[index]);
        }
        else if (keyword != nullptr) {
            keywordsUsed.emplace(*name);
            argumentValues.push_back(*keyword);
        }
        else {
            argumentValues.push_back(Value::undefined());
        }
    }
    std::optional<Value> caller;
    if (callerReference_) {
        keywordsUsed.emplace("caller");
        const Value* callerValue = keywords ? keywords->peek("caller") : nullptr;
        caller = callerValue != nullptr ? *callerValue : Value::undefined();
    }
    if (keywords) {
        for (const auto& entry : keywords->values().entries()) {
            const auto key = entry.first.asString();
            if (key && !keywordsUsed.contains(*key)) {
                throw TemplateError(TemplateErrorKind::TooManyArguments, "unknown keyword argument `" + std::string(*key) + "`");
            }
        }
    }
    std::string rendered;
    TemplateOutput output(rendered);
    static_cast<void>(TemplateVirtualMachine(state.environment())
        .evaluateMacro(state, macroReferenceId_, output, closure_, std::move(caller), std::move(argumentValues)));
    if (state.autoEscape().kind != AutoEscapeKind::None) return Value::fromSafeString(std::move(rendered));
    return Value::fromString(rendered);
}

void MacroObject::render(text_format::DebugWriter& writer) const {
    writer.write("<macro " + name_.toString() + ">");
}

void MacroObject::writeDebug(text_format::DebugWriter& writer) const {
    writer.write("<macro " + name_.toString() + ">");
}

EvaluationResult TemplateVirtualMachine::evaluate(const Instructions& instructions, Value root,
    const std::map<std::string, Instructions, std::less<>>& blocks, TemplateOutput& output, AutoEscape autoEscape) const {
    Frame rootFrame;
    rootFrame.context = root.validate();
    TemplateState state(TemplateContext(*environment_, std::move(rootFrame)), std::move(autoEscape), &instructions, prepareBlocks(blocks));
    std::optional<Value> value = evaluateState(state, output);
    return EvaluationResult{std::move(value), std::move(state)};
}

std::optional<Value> TemplateVirtualMachine::evaluateMacro(const TemplateState& state, std::size_t macroId, TemplateOutput& output, Value closure,
    std::optional<Value> caller, std::vector<Value> arguments) const {
    if (macroId >= state.macros_->size()) throw TemplateError(TemplateErrorKind::InvalidOperation, "index out of bounds");
    const auto [instructions, pc] = (*state.macros_)[macroId];
    Frame baseFrame;
    baseFrame.context = state.context_.cloneBase();
    TemplateContext context(*environment_, std::move(baseFrame));
    Frame closureFrame;
    closureFrame.context = std::move(closure);
    context.pushFrame(std::move(closureFrame));
    if (caller) context.store("caller", std::move(*caller));
    context.incrementDepth(state.context_.depth() + kMacroRecursionCost);
    TemplateState macroState(std::move(context), state.autoEscape(), instructions, {});
    macroState.temporariesMutex_ = state.temporariesMutex_;
    macroState.temporaries_ = state.temporaries_;
    macroState.id_ = state.id_;
    macroState.macros_ = state.macros_;
    macroState.closureTracker_ = state.closureTracker_;
    return run(macroState, output, std::move(arguments), pc);
}

std::optional<Value> TemplateVirtualMachine::evaluateState(TemplateState& state, TemplateOutput& output) const {
    return run(state, output, {}, 0);
}

std::optional<Value> TemplateVirtualMachine::run(TemplateState& state, TemplateOutput& output, std::vector<Value> stack, std::uint32_t pc) const {
    const AutoEscape initialAutoEscape = state.autoEscape_;
    const UndefinedBehavior undefinedBehavior = state.undefinedBehavior();
    std::vector<AutoEscape> autoEscapeStack;
    std::optional<std::pair<std::uint32_t, bool>> nextLoopRecursionJump;
    std::array<std::optional<Value>, kMaximumLocals> loadedFilters;
    std::array<std::optional<Value>, kMaximumLocals> loadedTests;
    const Instructions* parentInstructions = nullptr;
    stack.reserve(16);

    const auto lookupLocal = [](std::array<std::optional<Value>, kMaximumLocals>& cache, std::uint8_t id,
                                 const Value* (TemplateEnvironment::*lookup)(std::string_view) const, const TemplateEnvironment& environment,
                                 std::string_view name) -> std::optional<Value> {
        if (id == kUncachedLocal) {
            const Value* found = (environment.*lookup)(name);
            if (found == nullptr) return std::nullopt;
            return *found;
        }
        if (cache[id]) return cache[id];
        const Value* found = (environment.*lookup)(name);
        if (found == nullptr) return std::nullopt;
        cache[id] = *found;
        return cache[id];
    };

    for (;;) {
        const Instruction* current = state.instructions_->get(pc);
        if (current == nullptr) {
            if (parentInstructions == nullptr) break;
            state.instructions_ = std::exchange(parentInstructions, nullptr);
            static_cast<void>(output.endCapture(AutoEscape{}));
            pc = 0;
            loadedFilters = {};
            loadedTests = {};
            continue;
        }
        const Instruction& instruction = *current;
        bool skipErrorLocation = false;
        try {
            switch (instruction.kind) {
            case InstructionKind::Swap: {
                Value first = popValue(stack);
                Value second = popValue(stack);
                stack.push_back(std::move(first));
                stack.push_back(std::move(second));
                break;
            }
            case InstructionKind::EmitRaw:
                output.write(instruction.name);
                break;
            case InstructionKind::Emit:
                environment_->format(popValue(stack), state, output);
                break;
            case InstructionKind::StoreLocal:
                state.context_.store(instruction.name, popValue(stack));
                break;
            case InstructionKind::Lookup:
                stack.push_back(state.lookup(instruction.name).value_or(Value::undefined()).validate());
                break;
            case InstructionKind::GetAttr: {
                Value target = popValue(stack);
                if (auto value = target.getAttributeFast(instruction.name)) stack.push_back(value->validate());
                else stack.push_back(handleUndefined(undefinedBehavior, target.isUndefined()));
                break;
            }
            case InstructionKind::SetAttr: {
                Value target = popValue(stack);
                Value value = popValue(stack);
                const auto* object = target.asObject();
                auto* namespaceObject = object != nullptr ? dynamic_cast<NamespaceObject*>(object->get()) : nullptr;
                if (namespaceObject == nullptr) {
                    throw TemplateError(TemplateErrorKind::InvalidOperation,
                        "can only assign to namespaces, not " + std::string(valueKindName(target.kind())));
                }
                namespaceObject->setValue(instruction.name, std::move(value));
                break;
            }
            case InstructionKind::GetItem: {
                Value subscript = popValue(stack);
                Value target = popValue(stack);
                if (auto value = target.getItemOptional(subscript)) stack.push_back(value->validate());
                else stack.push_back(handleUndefined(undefinedBehavior, target.isUndefined()));
                break;
            }
            case InstructionKind::Slice: {
                Value step = popValue(stack);
                Value stop = popValue(stack);
                Value start = popValue(stack);
                Value target = popValue(stack);
                if (target.isUndefined() && undefinedBehavior == UndefinedBehavior::Strict) throw TemplateError(TemplateErrorKind::UndefinedError);
                stack.push_back(sliceValue(target, start, stop, step));
                break;
            }
            case InstructionKind::LoadConst:
                stack.push_back(instruction.constant);
                break;
            case InstructionKind::BuildMap:
            case InstructionKind::BuildKwargs: {
                ValueMap map;
                reverseTop(stack, instruction.count * 2);
                for (std::size_t index = 0; index < instruction.count; ++index) {
                    Value key = popValue(stack);
                    Value value = popValue(stack);
                    map.insert(std::move(key), std::move(value));
                }
                stack.push_back(instruction.kind == InstructionKind::BuildMap ? makeMap(std::move(map)) : KeywordArguments::wrap(std::move(map)));
                break;
            }
            case InstructionKind::MergeKwargs: {
                std::vector<Value> sources;
                for (std::size_t index = 0; index < instruction.count; ++index) sources.push_back(popValue(stack));
                std::ranges::reverse(sources);
                stack.push_back(mergeKeywordArguments(std::move(sources)));
                break;
            }
            case InstructionKind::BuildList: {
                std::size_t count = 0;
                if (instruction.optionalCount) {
                    count = *instruction.optionalCount;
                }
                else {
                    const auto popped = popValue(stack).tryUsize();
                    if (!popped) throw TemplateError(TemplateErrorKind::InvalidOperation, "called `Result::unwrap()` on an `Err` value");
                    count = *popped;
                }
                std::vector<Value> values;
                values.reserve(std::min<std::size_t>(count, 1024));
                for (std::size_t index = 0; index < count; ++index) values.push_back(popValue(stack));
                std::ranges::reverse(values);
                stack.push_back(Value::fromSequence(std::move(values)));
                break;
            }
            case InstructionKind::UnpackList: {
                Value top = popValue(stack);
                const auto* object = top.asObject();
                ValueIteratorPointer iterator = object != nullptr ? (*object)->tryIterate() : nullptr;
                if (!iterator) throw TemplateError(TemplateErrorKind::CannotUnpack, "value is not iterable");
                std::size_t produced = 0;
                while (auto item = iterator->next()) {
                    stack.push_back(std::move(*item));
                    ++produced;
                }
                if (produced != instruction.count) {
                    throw TemplateError(TemplateErrorKind::CannotUnpack,
                        "sequence of wrong length (expected " + std::to_string(instruction.count) + ", got " + std::to_string(produced) + ")");
                }
                reverseTop(stack, produced);
                break;
            }
            case InstructionKind::UnpackLists: {
                std::vector<Value> lists;
                for (std::size_t index = 0; index < instruction.count; ++index) lists.push_back(popValue(stack));
                std::size_t length = 0;
                for (auto list = lists.rbegin(); list != lists.rend(); ++list) {
                    auto iterator = list->tryIterate();
                    while (auto item = iterator->next()) {
                        stack.push_back(std::move(*item));
                        ++length;
                    }
                }
                stack.push_back(Value::fromUInt64(length));
                break;
            }
            case InstructionKind::Add:
            case InstructionKind::Sub:
            case InstructionKind::Mul:
            case InstructionKind::Div:
            case InstructionKind::IntDiv:
            case InstructionKind::Rem:
            case InstructionKind::Pow: {
                Value right = popValue(stack);
                Value left = popValue(stack);
                switch (instruction.kind) {
                case InstructionKind::Add: stack.push_back(addValues(left, right)); break;
                case InstructionKind::Sub: stack.push_back(subtractValues(left, right)); break;
                case InstructionKind::Mul: stack.push_back(multiplyValues(left, right)); break;
                case InstructionKind::Div: stack.push_back(divideValues(left, right)); break;
                case InstructionKind::IntDiv: stack.push_back(integerDivideValues(left, right)); break;
                case InstructionKind::Rem: stack.push_back(remainderValues(left, right)); break;
                default: stack.push_back(powerValues(left, right)); break;
                }
                break;
            }
            case InstructionKind::Eq:
            case InstructionKind::Ne:
            case InstructionKind::Gt:
            case InstructionKind::Gte:
            case InstructionKind::Lt:
            case InstructionKind::Lte: {
                Value right = popValue(stack);
                Value left = popValue(stack);
                bool result = false;
                switch (instruction.kind) {
                case InstructionKind::Eq: result = left == right; break;
                case InstructionKind::Ne: result = !(left == right); break;
                case InstructionKind::Gt: result = left.compare(right) == std::strong_ordering::greater; break;
                case InstructionKind::Gte: result = left.compare(right) != std::strong_ordering::less; break;
                case InstructionKind::Lt: result = left.compare(right) == std::strong_ordering::less; break;
                default: result = left.compare(right) != std::strong_ordering::greater; break;
                }
                stack.push_back(Value::fromBool(result));
                break;
            }
            case InstructionKind::Not:
                stack.push_back(Value::fromBool(!undefinedAwareTruth(undefinedBehavior, popValue(stack))));
                break;
            case InstructionKind::StringConcat: {
                Value right = popValue(stack);
                Value left = popValue(stack);
                stack.push_back(concatenateValues(left, right));
                break;
            }
            case InstructionKind::In: {
                Value container = popValue(stack);
                Value value = popValue(stack);
                assertIterable(state.undefinedBehavior(), container);
                stack.push_back(containsValue(container, value));
                break;
            }
            case InstructionKind::Neg:
                stack.push_back(negateValue(popValue(stack)));
                break;
            case InstructionKind::PushWith:
                state.context_.pushFrame(Frame{});
                break;
            case InstructionKind::PopFrame:
                static_cast<void>(state.context_.popFrame());
                break;
            case InstructionKind::PopLoopFrame: {
                Frame frame = state.context_.popFrame();
                if (frame.currentLoop && frame.currentLoop->currentRecursionJump) {
                    const auto [target, endCapture] = *frame.currentLoop->currentRecursionJump;
                    pc = target;
                    if (endCapture) stack.push_back(output.endCapture(state.autoEscape_));
                    continue;
                }
                break;
            }
            case InstructionKind::IsUndefined:
                stack.push_back(Value::fromBool(popValue(stack).isUndefined()));
                break;
            case InstructionKind::PushLoop: {
                Value iterable = popValue(stack);
                pushLoop(state, iterable, instruction.flags, pc, std::exchange(nextLoopRecursionJump, std::nullopt));
                break;
            }
            case InstructionKind::Iterate: {
                LoopState* loop = state.context_.currentLoop();
                auto item = loop->object->nextItem();
                if (!item) {
                    pc = instruction.target;
                    continue;
                }
                stack.push_back(item->validate());
                break;
            }
            case InstructionKind::PushDidNotIterate:
                stack.push_back(Value::fromBool(state.context_.currentLoop()->object->didNotIterate()));
                break;
            case InstructionKind::Jump:
                pc = instruction.target;
                continue;
            case InstructionKind::JumpIfFalse:
                if (!undefinedAwareTruth(undefinedBehavior, popValue(stack))) {
                    pc = instruction.target;
                    continue;
                }
                break;
            case InstructionKind::JumpIfFalseOrPop:
                if (!undefinedAwareTruth(undefinedBehavior, stack.back())) {
                    pc = instruction.target;
                    continue;
                }
                stack.pop_back();
                break;
            case InstructionKind::JumpIfTrueOrPop:
                if (undefinedAwareTruth(undefinedBehavior, stack.back())) {
                    pc = instruction.target;
                    continue;
                }
                stack.pop_back();
                break;
            case InstructionKind::PushAutoEscape: {
                Value value = popValue(stack);
                autoEscapeStack.push_back(state.autoEscape_);
                state.autoEscape_ = deriveAutoEscape(value, initialAutoEscape);
                break;
            }
            case InstructionKind::PopAutoEscape:
                state.autoEscape_ = std::move(autoEscapeStack.back());
                autoEscapeStack.pop_back();
                break;
            case InstructionKind::BeginCapture:
                output.beginCapture(instruction.captureMode);
                break;
            case InstructionKind::EndCapture:
                stack.push_back(output.endCapture(state.autoEscape_));
                break;
            case InstructionKind::ApplyFilter: {
                const auto filter = lookupLocal(loadedFilters, instruction.flags, &TemplateEnvironment::filter, *environment_, instruction.name);
                if (!filter) throw TemplateError(TemplateErrorKind::UnknownFilter, "filter " + instruction.name + " is unknown");
                const std::span<const Value> arguments = callArguments(stack, instruction.optionalCount);
                const std::size_t count = arguments.size();
                Value result = filter->call(state, arguments);
                dropTop(stack, count);
                stack.push_back(std::move(result));
                break;
            }
            case InstructionKind::PerformTest: {
                const auto test = lookupLocal(loadedTests, instruction.flags, &TemplateEnvironment::test, *environment_, instruction.name);
                if (!test) throw TemplateError(TemplateErrorKind::UnknownTest, "test " + instruction.name + " is unknown");
                const std::span<const Value> arguments = callArguments(stack, instruction.optionalCount);
                const std::size_t count = arguments.size();
                const bool result = test->call(state, arguments).isTrue();
                dropTop(stack, count);
                stack.push_back(Value::fromBool(result));
                break;
            }
            case InstructionKind::CallFunction: {
                const std::span<const Value> arguments = callArguments(stack, instruction.optionalCount);
                Value result;
                if (instruction.name == "super") {
                    if (!arguments.empty()) throw TemplateError(TemplateErrorKind::InvalidOperation, "super() takes no arguments");
                    result = performSuper(state, output, true);
                }
                else if (auto function = state.lookup(instruction.name)) {
                    const auto* object = function->asObject();
                    const auto* loop = object != nullptr ? dynamic_cast<LoopObject*>(object->get()) : nullptr;
                    if (loop != nullptr) {
                        if (arguments.size() != 1) throw TemplateError(TemplateErrorKind::InvalidOperation, "loop() takes one argument");
                        if (!loop->recurseJumpTarget()) throw TemplateError(TemplateErrorKind::InvalidOperation, "cannot recurse outside of recursive loop");
                        nextLoopRecursionJump = std::pair{pc + 1, true};
                        output.beginCapture(CaptureMode::Capture);
                        pc = *loop->recurseJumpTarget();
                        continue;
                    }
                    result = function->call(state, arguments);
                }
                else {
                    throw TemplateError(TemplateErrorKind::UnknownFunction, instruction.name + " is unknown");
                }
                dropTop(stack, arguments.size());
                stack.push_back(std::move(result));
                break;
            }
            case InstructionKind::CallMethod: {
                const std::span<const Value> arguments = callArguments(stack, instruction.optionalCount);
                const std::size_t count = arguments.size();
                Value result = arguments[0].callMethod(state, instruction.name, arguments.subspan(1));
                dropTop(stack, count);
                stack.push_back(std::move(result));
                break;
            }
            case InstructionKind::CallObject: {
                const std::span<const Value> arguments = callArguments(stack, instruction.optionalCount);
                const std::size_t count = arguments.size();
                Value result = arguments[0].call(state, arguments.subspan(1));
                dropTop(stack, count);
                stack.push_back(std::move(result));
                break;
            }
            case InstructionKind::DupTop:
                stack.push_back(stack.back());
                break;
            case InstructionKind::DiscardTop:
                stack.pop_back();
                break;
            case InstructionKind::FastSuper:
                static_cast<void>(performSuper(state, output, false));
                break;
            case InstructionKind::FastRecurse: {
                LoopState* loop = state.context_.currentLoop();
                if (loop == nullptr) throw TemplateError(TemplateErrorKind::UnknownFunction, "loop is unknown");
                if (!loop->object->recurseJumpTarget()) throw TemplateError(TemplateErrorKind::InvalidOperation, "cannot recurse outside of recursive loop");
                nextLoopRecursionJump = std::pair{pc + 1, false};
                pc = *loop->object->recurseJumpTarget();
                continue;
            }
            case InstructionKind::LoadBlocks: {
                Value name = popValue(stack);
                if (parentInstructions != nullptr) throw TemplateError(TemplateErrorKind::InvalidOperation, "tried to extend a second time in a template");
                parentInstructions = loadBlocks(name, state);
                output.beginCapture(CaptureMode::Discard);
                break;
            }
            case InstructionKind::Include: {
                Value name = popValue(stack);
                performInclude(name, state, output, instruction.enabled);
                break;
            }
            case InstructionKind::ExportLocals: {
                Value captured = popValue(stack);
                ValueMap values;
                for (const auto& [key, value] : state.context_.currentLocals()) values.insert(Value::fromString(key), value);
                stack.push_back(Value::fromObject(std::make_shared<ModuleObject>(std::move(values), std::move(captured))));
                break;
            }
            case InstructionKind::CallBlock:
                if (parentInstructions == nullptr && !output.isDiscarding()) {
                    skipErrorLocation = true;
                    static_cast<void>(callBlock(instruction.name, state, output));
                }
                break;
            case InstructionKind::BuildMacro: {
                Value specificationValue = popValue(stack);
                std::vector<Value> specification = collectValues(*specificationValue.tryIterate());
                Value closure = popValue(stack);
                const std::size_t reference = state.macros_->size();
                if (state.macros_.use_count() > 1) state.macros_ = std::make_shared<MacroTable>(*state.macros_);
                state.macros_->emplace_back(state.instructions_, instruction.target);
                stack.push_back(Value::fromObject(std::make_shared<MacroObject>(Value::fromString(instruction.name), std::move(specification), reference,
                    state.id_, std::move(closure), (instruction.flags & kMacroCaller) != 0)));
                break;
            }
            case InstructionKind::Return:
                if (stack.empty()) return std::nullopt;
                return popValue(stack);
            case InstructionKind::Enclose:
                if (!state.context_.closure()) {
                    auto closure = std::make_shared<ClosureObject>();
                    state.closureTracker_->track(closure);
                    state.context_.resetClosure(std::move(closure));
                }
                state.context_.enclose(instruction.name);
                break;
            case InstructionKind::GetClosure: {
                const auto closure = state.context_.closure();
                stack.push_back(closure ? Value::fromObject(closure) : Value::undefined());
                break;
            }
            }
        }
        catch (TemplateError& error) {
            if (!skipErrorLocation) processError(error, pc, state);
            throw;
        }
        ++pc;
    }
    if (stack.empty()) return std::nullopt;
    return popValue(stack);
}

Value TemplateVirtualMachine::mergeKeywordArguments(std::vector<Value> values) const {
    ValueMap merged;
    for (const Value& value : values) {
        assertIterable(environment_->undefinedBehavior(), value);
        const auto* object = value.asObject();
        std::optional<std::vector<std::pair<Value, Value>>> pairs;
        if (object != nullptr && (*object)->representation() == ObjectRepresentation::Map) pairs = (*object)->tryIteratePairs();
        if (!pairs) {
            throw TemplateError(TemplateErrorKind::InvalidOperation,
                "attempted to apply keyword arguments from non map (got " + std::string(valueKindName(value.kind())) + ")");
        }
        for (auto& [key, item] : *pairs) merged.insert(std::move(key), std::move(item));
    }
    return KeywordArguments::wrap(std::move(merged));
}

void TemplateVirtualMachine::performInclude(const Value& name, TemplateState& state, TemplateOutput& output, bool ignoreMissing) const {
    std::vector<Value> choices;
    if (const auto* object = name.asObject()) {
        if (auto iterator = (*object)->tryIterate()) choices = collectValues(*iterator);
    }
    else {
        choices.push_back(name);
    }
    std::vector<Value> templatesTried;
    for (const Value& choice : choices) {
        const auto templateName = choice.asString();
        if (!templateName) throw TemplateError(TemplateErrorKind::InvalidOperation, "template name was not a string");
        std::optional<TemplateHandle> handle;
        try {
            handle = environment_->getTemplate(environment_->joinTemplatePath(*templateName, state.name()));
        }
        catch (const TemplateError& error) {
            if (error.kind() != TemplateErrorKind::TemplateNotFound) throw;
            templatesTried.push_back(choice);
            continue;
        }
        if (!handle->borrowed()) {
            throw TemplateError(TemplateErrorKind::InvalidOperation, "cannot extend or include template not borrowed from environment");
        }
        const CompiledTemplate& compiled = handle->compiled();
        AutoEscape oldEscape = std::exchange(state.autoEscape_, compiled.initialAutoEscape);
        const Instructions* oldInstructions = std::exchange(state.instructions_, &compiled.compiled.instructions);
        auto oldBlocks = std::exchange(state.blocks_, prepareBlocks(compiled.compiled.blocks));
        auto oldLoadedTemplates = state.loadedTemplates_;
        state.context_.incrementDepth(kIncludeRecursionCost);
        std::shared_ptr<ClosureObject> oldClosure = state.context_.takeClosure();
        std::optional<TemplateError> failure;
        try {
            static_cast<void>(evaluateState(state, output));
        }
        catch (TemplateError& error) {
            failure = std::move(error);
        }
        state.context_.resetClosure(std::move(oldClosure));
        state.context_.decrementDepth(kIncludeRecursionCost);
        state.loadedTemplates_ = std::move(oldLoadedTemplates);
        state.autoEscape_ = std::move(oldEscape);
        state.instructions_ = oldInstructions;
        state.blocks_ = std::move(oldBlocks);
        if (failure) throw TemplateError(TemplateErrorKind::BadInclude, "error in \"" + std::string(handle->name()) + "\"");
        return;
    }
    if (!templatesTried.empty() && !ignoreMissing) {
        if (templatesTried.size() == 1) {
            throw TemplateError(TemplateErrorKind::TemplateNotFound, "tried to include non-existing template " + debugString(templatesTried.front()));
        }
        throw TemplateError(TemplateErrorKind::TemplateNotFound,
            "tried to include one of multiple templates, none of which existed " + Value::fromSequence(templatesTried).toString());
    }
}

Value TemplateVirtualMachine::performSuper(TemplateState& state, TemplateOutput& output, bool capture) const {
    if (!state.currentBlock_) throw TemplateError(TemplateErrorKind::InvalidOperation, "cannot super outside of block");
    const std::string name = *state.currentBlock_;
    BlockStack& blockStack = state.blocks_.find(name)->second;
    if (!blockStack.push()) throw TemplateError(TemplateErrorKind::InvalidOperation, "no parent block exists");
    if (capture) output.beginCapture(CaptureMode::Capture);
    const Instructions* oldInstructions = std::exchange(state.instructions_, blockStack.instructions());
    state.context_.pushFrame(Frame{});
    std::optional<TemplateError> failure;
    try {
        static_cast<void>(evaluateState(state, output));
    }
    catch (TemplateError& error) {
        failure = std::move(error);
    }
    static_cast<void>(state.context_.popFrame());
    state.instructions_ = oldInstructions;
    state.blocks_.find(name)->second.pop();
    if (failure) throw TemplateError(TemplateErrorKind::EvalBlock, "error in super block");
    if (capture) return output.endCapture(state.autoEscape_);
    return Value::undefined();
}

const Instructions* TemplateVirtualMachine::loadBlocks(const Value& name, TemplateState& state) const {
    const auto templateName = name.asString();
    if (!templateName) throw TemplateError(TemplateErrorKind::InvalidOperation, "template name was not a string");
    if (state.loadedTemplates_.contains(*templateName)) {
        throw TemplateError(TemplateErrorKind::InvalidOperation,
            "cycle in template inheritance. " + unicode::debugEscapedString(*templateName) + " was referenced more than once");
    }
    const TemplateHandle handle = environment_->getTemplate(environment_->joinTemplatePath(*templateName, state.name()));
    if (!handle.borrowed()) throw TemplateError(TemplateErrorKind::InvalidOperation, "cannot extend or include template not borrowed from environment");
    const CompiledTemplate& compiled = handle.compiled();
    state.loadedTemplates_.insert(compiled.compiled.instructions.name());
    for (const auto& [blockName, instructions] : compiled.compiled.blocks) {
        auto found = state.blocks_.find(blockName);
        if (found == state.blocks_.end()) found = state.blocks_.emplace(blockName, BlockStack{}).first;
        found->second.appendInstructions(&instructions);
    }
    return &compiled.compiled.instructions;
}

std::optional<Value> TemplateVirtualMachine::callBlock(std::string_view name, TemplateState& state, TemplateOutput& output) const {
    const auto found = state.blocks_.find(name);
    if (found == state.blocks_.end()) throw TemplateError(TemplateErrorKind::UnknownBlock, "block '" + std::string(name) + "' not found");
    std::optional<std::string> oldBlock = std::exchange(state.currentBlock_, std::string(found->first));
    const Instructions* oldInstructions = std::exchange(state.instructions_, found->second.instructions());
    state.context_.pushFrame(Frame{});
    std::optional<Value> result;
    std::optional<TemplateError> failure;
    try {
        result = evaluateState(state, output);
    }
    catch (TemplateError& error) {
        failure = std::move(error);
    }
    static_cast<void>(state.context_.popFrame());
    state.instructions_ = oldInstructions;
    state.currentBlock_ = std::move(oldBlock);
    if (failure) throw std::move(*failure);
    return result;
}

AutoEscape TemplateVirtualMachine::deriveAutoEscape(const Value& value, const AutoEscape& initial) const {
    const auto text = value.asString();
    const bool isTrueValue = value == Value::fromBool(true);
    if (text && *text == "html") return AutoEscape{AutoEscapeKind::Html, {}};
    if (text && *text == "json") return AutoEscape{AutoEscapeKind::Json, {}};
    if ((text && *text == "none") || (!text && !isTrueValue)) return AutoEscape{};
    if (!text && isTrueValue) return initial.kind == AutoEscapeKind::None ? AutoEscape{AutoEscapeKind::Html, {}} : initial;
    throw TemplateError(TemplateErrorKind::InvalidOperation, "invalid value to autoescape tag");
}

void TemplateVirtualMachine::pushLoop(TemplateState& state, const Value& iterable, std::uint8_t flags, std::uint32_t pc,
    std::optional<std::pair<std::uint32_t, bool>> currentRecursionJump) const {
    ValueIteratorPointer iterator;
    try {
        assertIterable(state.undefinedBehavior(), iterable);
        iterator = iterable.tryIterate();
    }
    catch (TemplateError& error) {
        if (!currentRecursionJump) throw;
        processError(error, pc, state);
        TemplateError callError(TemplateErrorKind::InvalidOperation, "cannot recurse because of non-iterable value");
        processError(callError, currentRecursionJump->first - 1, state);
        throw callError;
    }
    std::size_t depth = 0;
    if (LoopState* loop = state.context_.currentLoop(); loop != nullptr && loop->object->recurseJumpTarget()) depth = loop->object->depth() + 1;
    const std::optional<std::size_t> length = exactLength(iterator->sizeHint());
    Frame frame;
    frame.currentLoop = LoopState{
        (flags & kLoopFlagWithLoopVariable) != 0,
        currentRecursionJump,
        std::make_shared<LoopObject>(std::move(iterator), length, depth,
            (flags & kLoopFlagRecursive) != 0 ? std::optional<std::uint32_t>(pc) : std::nullopt),
    };
    state.context_.pushFrame(std::move(frame));
}

}
