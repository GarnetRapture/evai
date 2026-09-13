#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "chat_template/template_error.h"
#include "chat_template/template_value.h"

namespace eversoul::native::chat_template {

inline constexpr std::uint8_t kLoopFlagWithLoopVariable = 1;
inline constexpr std::uint8_t kLoopFlagRecursive = 2;
inline constexpr std::uint8_t kMacroCaller = 2;
inline constexpr std::size_t kMaximumLocals = 50;
inline constexpr std::uint8_t kUncachedLocal = 0xFF;

enum class CaptureMode { Capture, Discard };

enum class InstructionKind {
    EmitRaw,
    StoreLocal,
    Lookup,
    GetAttr,
    SetAttr,
    GetItem,
    Slice,
    LoadConst,
    BuildMap,
    BuildKwargs,
    MergeKwargs,
    BuildList,
    UnpackList,
    UnpackLists,
    Add,
    Sub,
    Mul,
    Div,
    IntDiv,
    Rem,
    Pow,
    Neg,
    Eq,
    Ne,
    Gt,
    Gte,
    Lt,
    Lte,
    Not,
    StringConcat,
    In,
    ApplyFilter,
    PerformTest,
    Emit,
    PushLoop,
    PushWith,
    Iterate,
    PushDidNotIterate,
    PopFrame,
    PopLoopFrame,
    Jump,
    JumpIfFalse,
    JumpIfFalseOrPop,
    JumpIfTrueOrPop,
    PushAutoEscape,
    PopAutoEscape,
    BeginCapture,
    EndCapture,
    CallFunction,
    CallMethod,
    CallObject,
    DupTop,
    DiscardTop,
    FastSuper,
    FastRecurse,
    Swap,
    CallBlock,
    LoadBlocks,
    Include,
    ExportLocals,
    BuildMacro,
    Return,
    IsUndefined,
    Enclose,
    GetClosure,
};

struct Instruction {
    InstructionKind kind = InstructionKind::Return;
    std::string name;
    std::size_t count = 0;
    std::optional<std::size_t> optionalCount;
    std::uint32_t target = 0;
    std::uint8_t flags = 0;
    bool enabled = false;
    CaptureMode captureMode = CaptureMode::Capture;
    Value constant;
};

class Instructions {
public:
    Instructions(std::string name, std::string source);

    [[nodiscard]] const std::string& name() const noexcept { return name_; }
    [[nodiscard]] const std::string& source() const noexcept { return source_; }
    [[nodiscard]] const Instruction* get(std::uint32_t index) const noexcept;
    [[nodiscard]] Instruction* getMutable(std::uint32_t index) noexcept;
    std::uint32_t add(Instruction instruction);
    std::uint32_t addWithLine(Instruction instruction, std::uint16_t line);
    std::uint32_t addWithSpan(Instruction instruction, TemplateSpan span);
    [[nodiscard]] std::optional<std::size_t> lineOf(std::uint32_t index) const;
    [[nodiscard]] std::optional<TemplateSpan> spanOf(std::uint32_t index) const;
    [[nodiscard]] std::size_t size() const noexcept { return instructions_.size(); }

private:
    struct LineInfo {
        std::uint32_t firstInstruction;
        std::uint16_t line;
    };
    struct SpanInfo {
        std::uint32_t firstInstruction;
        TemplateSpan span;
    };

    void addLineRecord(std::uint32_t instruction, std::uint16_t line);

    std::vector<Instruction> instructions_;
    std::vector<LineInfo> lineInfos_;
    std::vector<SpanInfo> spanInfos_;
    std::string name_;
    std::string source_;
};

}
