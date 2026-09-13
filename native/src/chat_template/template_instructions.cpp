#include "chat_template/template_instructions.h"

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <iterator>
#include <optional>
#include <string>
#include <utility>

namespace eversoul::native::chat_template {

Instructions::Instructions(std::string name, std::string source) : name_(std::move(name)), source_(std::move(source)) {
    instructions_.reserve(128);
    lineInfos_.reserve(128);
    spanInfos_.reserve(128);
}

const Instruction* Instructions::get(std::uint32_t index) const noexcept {
    return index < instructions_.size() ? &instructions_[index] : nullptr;
}

Instruction* Instructions::getMutable(std::uint32_t index) noexcept {
    return index < instructions_.size() ? &instructions_[index] : nullptr;
}

std::uint32_t Instructions::add(Instruction instruction) {
    const auto index = static_cast<std::uint32_t>(instructions_.size());
    instructions_.push_back(std::move(instruction));
    return index;
}

void Instructions::addLineRecord(std::uint32_t instruction, std::uint16_t line) {
    if (!lineInfos_.empty() && lineInfos_.back().line == line) return;
    lineInfos_.push_back({instruction, line});
}

std::uint32_t Instructions::addWithLine(Instruction instruction, std::uint16_t line) {
    const std::uint32_t index = add(std::move(instruction));
    addLineRecord(index, line);
    if (!spanInfos_.empty() && !(spanInfos_.back().span == TemplateSpan{})) spanInfos_.push_back({index, TemplateSpan{}});
    return index;
}

std::uint32_t Instructions::addWithSpan(Instruction instruction, TemplateSpan span) {
    const std::uint32_t index = add(std::move(instruction));
    if (spanInfos_.empty() || !(spanInfos_.back().span == span)) spanInfos_.push_back({index, span});
    addLineRecord(index, span.startLine);
    return index;
}

std::optional<std::size_t> Instructions::lineOf(std::uint32_t index) const {
    const auto position = std::ranges::upper_bound(lineInfos_, index, {}, &LineInfo::firstInstruction);
    if (position == lineInfos_.begin()) return std::nullopt;
    return std::prev(position)->line;
}

std::optional<TemplateSpan> Instructions::spanOf(std::uint32_t index) const {
    const auto position = std::ranges::upper_bound(spanInfos_, index, {}, &SpanInfo::firstInstruction);
    if (position == spanInfos_.begin()) return std::nullopt;
    const TemplateSpan& span = std::prev(position)->span;
    if (span == TemplateSpan{}) return std::nullopt;
    return span;
}

}
