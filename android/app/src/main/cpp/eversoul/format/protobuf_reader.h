#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "eversoul/core/failure.h"
#include "eversoul/format/byte_reader.h"

namespace eversoul::format {

enum class ProtobufWireType : std::uint8_t {
    Varint = 0,
    Fixed64 = 1,
    LengthDelimited = 2,
    StartGroup = 3,
    EndGroup = 4,
    Fixed32 = 5,
};

struct ProtobufField {
    std::uint32_t number;
    ProtobufWireType wireType;
    std::uint64_t scalar;
    ByteSpan payload;
};

class ProtobufReader {
public:
    explicit ProtobufReader(ByteSpan message) noexcept;

    [[nodiscard]] core::Result<std::optional<ProtobufField>> next();

private:
    [[nodiscard]] core::Result<std::uint64_t> readVarint();

    ByteSpan message_;
    std::size_t position_ = 0;
};

[[nodiscard]] std::string protobufString(const ProtobufField& field);
[[nodiscard]] std::int32_t protobufInt32(const ProtobufField& field) noexcept;
[[nodiscard]] bool protobufBool(const ProtobufField& field) noexcept;
[[nodiscard]] core::Result<float> protobufFloat32(const ProtobufField& field);
[[nodiscard]] core::Result<void> appendProtobufInt32Values(const ProtobufField& field, std::vector<std::int32_t>& values);
[[nodiscard]] core::Result<void> expectWireType(const ProtobufField& field, ProtobufWireType wireType, std::string_view context);

}
