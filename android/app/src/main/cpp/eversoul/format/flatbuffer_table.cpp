#include "eversoul/format/flatbuffer_table.h"

#include <string>

namespace eversoul::format {
namespace {

constexpr std::size_t kVtableHeaderBytes = 4;
constexpr std::size_t kOffsetBytes = sizeof(std::uint32_t);
constexpr std::size_t kVtableEntryBytes = sizeof(std::uint16_t);

core::Result<std::size_t> followOffset(ByteSpan buffer, std::size_t position) {
    auto offset = readLittleEndian<std::uint32_t>(buffer, position);
    if (!offset) {
        return std::unexpected(offset.error());
    }
    const std::size_t target = position + *offset;
    if (target >= buffer.size()) {
        return core::fail(core::FailureCode::InvalidModelFile, "flatbuffer_offset_out_of_bounds:" + std::to_string(position));
    }
    return target;
}

}

FlatBufferTable::FlatBufferTable(ByteSpan buffer, std::size_t tablePosition, std::size_t vtablePosition, std::uint16_t vtableSize)
    : buffer_(buffer), tablePosition_(tablePosition), vtablePosition_(vtablePosition), vtableSize_(vtableSize) {}

core::Result<FlatBufferTable> FlatBufferTable::root(ByteSpan buffer) {
    auto tablePosition = followOffset(buffer, 0);
    if (!tablePosition) {
        return std::unexpected(tablePosition.error());
    }
    return at(buffer, *tablePosition);
}

core::Result<FlatBufferTable> FlatBufferTable::at(ByteSpan buffer, std::size_t tablePosition) {
    auto vtableDistance = readLittleEndian<std::int32_t>(buffer, tablePosition);
    if (!vtableDistance) {
        return std::unexpected(vtableDistance.error());
    }
    const auto signedVtablePosition = static_cast<std::int64_t>(tablePosition) - static_cast<std::int64_t>(*vtableDistance);
    if (signedVtablePosition < 0 || static_cast<std::size_t>(signedVtablePosition) >= buffer.size()) {
        return core::fail(core::FailureCode::InvalidModelFile, "flatbuffer_vtable_out_of_bounds:" + std::to_string(tablePosition));
    }
    const auto vtablePosition = static_cast<std::size_t>(signedVtablePosition);
    auto vtableSize = readLittleEndian<std::uint16_t>(buffer, vtablePosition);
    if (!vtableSize) {
        return std::unexpected(vtableSize.error());
    }
    if (*vtableSize < kVtableHeaderBytes || vtablePosition + *vtableSize > buffer.size()) {
        return core::fail(core::FailureCode::InvalidModelFile, "flatbuffer_vtable_size_invalid:" + std::to_string(vtablePosition));
    }
    return FlatBufferTable(buffer, tablePosition, vtablePosition, *vtableSize);
}

core::Result<std::optional<std::size_t>> FlatBufferTable::fieldPosition(std::uint16_t fieldIndex) const {
    const std::size_t entryOffset = kVtableHeaderBytes + static_cast<std::size_t>(fieldIndex) * kVtableEntryBytes;
    if (entryOffset + kVtableEntryBytes > vtableSize_) {
        return std::optional<std::size_t>{};
    }
    auto fieldOffset = readLittleEndian<std::uint16_t>(buffer_, vtablePosition_ + entryOffset);
    if (!fieldOffset) {
        return std::unexpected(fieldOffset.error());
    }
    if (*fieldOffset == 0) {
        return std::optional<std::size_t>{};
    }
    return std::optional<std::size_t>{tablePosition_ + *fieldOffset};
}

core::Result<std::optional<std::size_t>> FlatBufferTable::referencedPosition(std::uint16_t fieldIndex) const {
    auto position = fieldPosition(fieldIndex);
    if (!position) {
        return std::unexpected(position.error());
    }
    if (!position->has_value()) {
        return std::optional<std::size_t>{};
    }
    auto target = followOffset(buffer_, **position);
    if (!target) {
        return std::unexpected(target.error());
    }
    return std::optional<std::size_t>{*target};
}

core::Result<std::optional<FlatBufferTable>> FlatBufferTable::table(std::uint16_t fieldIndex) const {
    auto target = referencedPosition(fieldIndex);
    if (!target) {
        return std::unexpected(target.error());
    }
    if (!target->has_value()) {
        return std::optional<FlatBufferTable>{};
    }
    auto nested = at(buffer_, **target);
    if (!nested) {
        return std::unexpected(nested.error());
    }
    return std::optional<FlatBufferTable>{*nested};
}

core::Result<std::optional<std::string_view>> FlatBufferTable::string(std::uint16_t fieldIndex) const {
    auto target = referencedPosition(fieldIndex);
    if (!target) {
        return std::unexpected(target.error());
    }
    if (!target->has_value()) {
        return std::optional<std::string_view>{};
    }
    auto length = readLittleEndian<std::uint32_t>(buffer_, **target);
    if (!length) {
        return std::unexpected(length.error());
    }
    auto characters = sliceBytes(buffer_, **target + kOffsetBytes, *length);
    if (!characters) {
        return std::unexpected(characters.error());
    }
    return std::optional<std::string_view>{std::string_view(reinterpret_cast<const char*>(characters->data()), characters->size())};
}

core::Result<std::optional<FlatBufferTableVector>> FlatBufferTable::tableVector(std::uint16_t fieldIndex) const {
    auto target = referencedPosition(fieldIndex);
    if (!target) {
        return std::unexpected(target.error());
    }
    if (!target->has_value()) {
        return std::optional<FlatBufferTableVector>{};
    }
    auto length = readLittleEndian<std::uint32_t>(buffer_, **target);
    if (!length) {
        return std::unexpected(length.error());
    }
    const std::size_t elementsPosition = **target + kOffsetBytes;
    if (static_cast<std::size_t>(*length) > (buffer_.size() - elementsPosition) / kOffsetBytes) {
        return core::fail(core::FailureCode::InvalidModelFile, "flatbuffer_vector_out_of_bounds:" + std::to_string(**target));
    }
    return std::optional<FlatBufferTableVector>{FlatBufferTableVector(buffer_, elementsPosition, *length)};
}

FlatBufferTableVector::FlatBufferTableVector(ByteSpan buffer, std::size_t elementsPosition, std::uint32_t length)
    : buffer_(buffer), elementsPosition_(elementsPosition), length_(length) {}

core::Result<FlatBufferTable> FlatBufferTableVector::at(std::uint32_t index) const {
    if (index >= length_) {
        return core::fail(core::FailureCode::InvalidModelFile, "flatbuffer_vector_index:" + std::to_string(index));
    }
    auto tablePosition = followOffset(buffer_, elementsPosition_ + static_cast<std::size_t>(index) * kOffsetBytes);
    if (!tablePosition) {
        return std::unexpected(tablePosition.error());
    }
    return FlatBufferTable::at(buffer_, *tablePosition);
}

}
