#pragma once

#include <bit>
#include <concepts>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <span>
#include <string>

#include "eversoul/core/failure.h"

namespace eversoul::format {

using ByteSpan = std::span<const std::byte>;

template <std::integral Value>
[[nodiscard]] core::Result<Value> readLittleEndian(ByteSpan bytes, std::size_t offset) {
    if (offset > bytes.size() || bytes.size() - offset < sizeof(Value)) {
        return core::fail(core::FailureCode::InvalidModelFile, "read_out_of_bounds:" + std::to_string(offset));
    }
    Value value{};
    std::memcpy(&value, bytes.data() + offset, sizeof(Value));
    if constexpr (std::endian::native == std::endian::big) {
        value = std::byteswap(value);
    }
    return value;
}

[[nodiscard]] core::Result<float> readLittleEndianFloat32(ByteSpan bytes, std::size_t offset);

[[nodiscard]] core::Result<ByteSpan> sliceBytes(ByteSpan bytes, std::size_t offset, std::size_t length);

}
