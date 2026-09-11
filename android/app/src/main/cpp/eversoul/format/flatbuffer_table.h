#pragma once

#include <concepts>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <string_view>

#include "eversoul/core/failure.h"
#include "eversoul/format/byte_reader.h"

namespace eversoul::format {

class FlatBufferTableVector;

class FlatBufferTable {
public:
    [[nodiscard]] static core::Result<FlatBufferTable> root(ByteSpan buffer);

    [[nodiscard]] core::Result<std::optional<FlatBufferTable>> table(std::uint16_t fieldIndex) const;
    [[nodiscard]] core::Result<std::optional<std::string_view>> string(std::uint16_t fieldIndex) const;
    [[nodiscard]] core::Result<std::optional<FlatBufferTableVector>> tableVector(std::uint16_t fieldIndex) const;

    template <std::integral Value>
    [[nodiscard]] core::Result<Value> scalar(std::uint16_t fieldIndex, Value defaultValue) const {
        auto position = fieldPosition(fieldIndex);
        if (!position) {
            return std::unexpected(position.error());
        }
        if (!position->has_value()) {
            return defaultValue;
        }
        return readLittleEndian<Value>(buffer_, **position);
    }

private:
    friend class FlatBufferTableVector;

    FlatBufferTable(ByteSpan buffer, std::size_t tablePosition, std::size_t vtablePosition, std::uint16_t vtableSize);

    [[nodiscard]] static core::Result<FlatBufferTable> at(ByteSpan buffer, std::size_t tablePosition);
    [[nodiscard]] core::Result<std::optional<std::size_t>> fieldPosition(std::uint16_t fieldIndex) const;
    [[nodiscard]] core::Result<std::optional<std::size_t>> referencedPosition(std::uint16_t fieldIndex) const;

    ByteSpan buffer_;
    std::size_t tablePosition_;
    std::size_t vtablePosition_;
    std::uint16_t vtableSize_;
};

class FlatBufferTableVector {
public:
    [[nodiscard]] std::uint32_t size() const noexcept { return length_; }
    [[nodiscard]] core::Result<FlatBufferTable> at(std::uint32_t index) const;

private:
    friend class FlatBufferTable;

    FlatBufferTableVector(ByteSpan buffer, std::size_t elementsPosition, std::uint32_t length);

    ByteSpan buffer_;
    std::size_t elementsPosition_;
    std::uint32_t length_;
};

}
