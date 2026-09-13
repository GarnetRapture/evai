#include "text_format/debug_writer.h"

#include <cstddef>
#include <functional>
#include <string>
#include <string_view>

namespace eversoul::native::text_format {

DebugWriter::DebugWriter(std::string& output, bool alternate) noexcept : output_(&output), alternate_(alternate) {}

DebugWriter::DebugWriter(DebugWriter& parent, bool* onNewline, bool alternate) noexcept
    : parent_(&parent), onNewline_(onNewline), alternate_(alternate) {}

DebugWriter DebugWriter::withAlternate(bool alternate) noexcept {
    return DebugWriter(*this, nullptr, alternate);
}

void DebugWriter::write(std::string_view text) {
    if (parent_ == nullptr) {
        output_->append(text);
        return;
    }
    if (onNewline_ == nullptr) {
        parent_->write(text);
        return;
    }
    while (!text.empty()) {
        const std::size_t newline = text.find('\n');
        const std::size_t length = newline == std::string_view::npos ? text.size() : newline + 1;
        const std::string_view segment = text.substr(0, length);
        if (*onNewline_) parent_->write("    ");
        *onNewline_ = segment.ends_with('\n');
        parent_->write(segment);
        text.remove_prefix(length);
    }
}

void DebugWriter::writeList(std::size_t count, const std::function<void(std::size_t, DebugWriter&)>& writeEntry) {
    write("[");
    for (std::size_t index = 0; index < count; ++index) {
        if (alternate_) {
            if (index == 0) write("\n");
            bool onNewline = true;
            DebugWriter padded(*this, &onNewline, alternate_);
            writeEntry(index, padded);
            padded.write(",\n");
        }
        else {
            if (index > 0) write(", ");
            writeEntry(index, *this);
        }
    }
    write("]");
}

void DebugWriter::writeMap(std::size_t count, const std::function<void(std::size_t, DebugWriter&)>& writeKey,
    const std::function<void(std::size_t, DebugWriter&)>& writeValue) {
    write("{");
    for (std::size_t index = 0; index < count; ++index) {
        if (alternate_) {
            if (index == 0) write("\n");
            bool onNewline = true;
            DebugWriter padded(*this, &onNewline, alternate_);
            writeKey(index, padded);
            padded.write(": ");
            writeValue(index, padded);
            padded.write(",\n");
        }
        else {
            if (index > 0) write(", ");
            writeKey(index, *this);
            write(": ");
            writeValue(index, *this);
        }
    }
    write("}");
}

void DebugWriter::writeStruct(std::string_view name, std::size_t count, const std::function<std::string_view(std::size_t)>& fieldName,
    const std::function<void(std::size_t, DebugWriter&)>& writeField) {
    write(name);
    for (std::size_t index = 0; index < count; ++index) {
        if (alternate_) {
            if (index == 0) write(" {\n");
            bool onNewline = true;
            DebugWriter padded(*this, &onNewline, alternate_);
            padded.write(fieldName(index));
            padded.write(": ");
            writeField(index, padded);
            padded.write(",\n");
        }
        else {
            write(index == 0 ? " { " : ", ");
            write(fieldName(index));
            write(": ");
            writeField(index, *this);
        }
    }
    if (count > 0) write(alternate_ ? "}" : " }");
}

void DebugWriter::writeTuple(std::string_view name, std::size_t count, const std::function<void(std::size_t, DebugWriter&)>& writeField) {
    write(name);
    for (std::size_t index = 0; index < count; ++index) {
        if (alternate_) {
            if (index == 0) write("(\n");
            bool onNewline = true;
            DebugWriter padded(*this, &onNewline, alternate_);
            writeField(index, padded);
            padded.write(",\n");
        }
        else {
            write(index == 0 ? "(" : ", ");
            writeField(index, *this);
        }
    }
    if (count > 0) {
        if (count == 1 && name.empty() && !alternate_) write(",");
        write(")");
    }
}

}
