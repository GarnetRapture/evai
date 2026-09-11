#include "eversoul/format/protobuf_reader.h"

#include <bit>

namespace eversoul::format {
namespace {

constexpr std::uint32_t kWireTypeBits = 3;
constexpr std::uint64_t kWireTypeMask = 0x7;
constexpr std::uint32_t kMaxVarintBytes = 10;
constexpr std::uint8_t kVarintPayloadMask = 0x7f;
constexpr std::uint8_t kVarintContinuationBit = 0x80;
constexpr std::uint32_t kVarintPayloadBits = 7;

core::Result<std::uint64_t> decodeVarint(ByteSpan bytes, std::size_t& position) {
    std::uint64_t value = 0;
    for (std::uint32_t index = 0; index < kMaxVarintBytes; ++index) {
        if (position >= bytes.size()) {
            return core::fail(core::FailureCode::InvalidModelFile, "protobuf_varint_truncated");
        }
        const auto byte = std::to_integer<std::uint8_t>(bytes[position++]);
        value |= static_cast<std::uint64_t>(byte & kVarintPayloadMask) << (index * kVarintPayloadBits);
        if ((byte & kVarintContinuationBit) == 0) {
            return value;
        }
    }
    return core::fail(core::FailureCode::InvalidModelFile, "protobuf_varint_overflow");
}

}

ProtobufReader::ProtobufReader(ByteSpan message) noexcept : message_(message) {}

core::Result<std::uint64_t> ProtobufReader::readVarint() {
    return decodeVarint(message_, position_);
}

core::Result<std::optional<ProtobufField>> ProtobufReader::next() {
    if (position_ >= message_.size()) {
        return std::optional<ProtobufField>{};
    }
    auto key = readVarint();
    if (!key) {
        return std::unexpected(key.error());
    }
    const auto wireType = static_cast<ProtobufWireType>(*key & kWireTypeMask);
    const auto number = static_cast<std::uint32_t>(*key >> kWireTypeBits);
    if (number == 0) {
        return core::fail(core::FailureCode::InvalidModelFile, "protobuf_field_number_zero");
    }
    ProtobufField field{number, wireType, 0, {}};
    switch (wireType) {
        case ProtobufWireType::Varint: {
            auto scalar = readVarint();
            if (!scalar) {
                return std::unexpected(scalar.error());
            }
            field.scalar = *scalar;
            break;
        }
        case ProtobufWireType::Fixed64: {
            auto scalar = readLittleEndian<std::uint64_t>(message_, position_);
            if (!scalar) {
                return std::unexpected(scalar.error());
            }
            field.scalar = *scalar;
            position_ += sizeof(std::uint64_t);
            break;
        }
        case ProtobufWireType::Fixed32: {
            auto scalar = readLittleEndian<std::uint32_t>(message_, position_);
            if (!scalar) {
                return std::unexpected(scalar.error());
            }
            field.scalar = *scalar;
            position_ += sizeof(std::uint32_t);
            break;
        }
        case ProtobufWireType::LengthDelimited: {
            auto length = readVarint();
            if (!length) {
                return std::unexpected(length.error());
            }
            auto payload = sliceBytes(message_, position_, static_cast<std::size_t>(*length));
            if (!payload) {
                return std::unexpected(payload.error());
            }
            field.payload = *payload;
            position_ += payload->size();
            break;
        }
        case ProtobufWireType::StartGroup:
        case ProtobufWireType::EndGroup:
            return core::fail(core::FailureCode::InvalidModelFile, "protobuf_group_unsupported:" + std::to_string(number));
        default:
            return core::fail(core::FailureCode::InvalidModelFile, "protobuf_wire_type_invalid:" + std::to_string(number));
    }
    return std::optional<ProtobufField>{field};
}

std::string protobufString(const ProtobufField& field) {
    return std::string(reinterpret_cast<const char*>(field.payload.data()), field.payload.size());
}

std::int32_t protobufInt32(const ProtobufField& field) noexcept {
    return static_cast<std::int32_t>(static_cast<std::uint32_t>(field.scalar));
}

bool protobufBool(const ProtobufField& field) noexcept {
    return field.scalar != 0;
}

core::Result<float> protobufFloat32(const ProtobufField& field) {
    if (field.wireType != ProtobufWireType::Fixed32) {
        return core::fail(core::FailureCode::InvalidModelFile, "protobuf_float_wire_type:" + std::to_string(field.number));
    }
    return std::bit_cast<float>(static_cast<std::uint32_t>(field.scalar));
}

core::Result<void> appendProtobufInt32Values(const ProtobufField& field, std::vector<std::int32_t>& values) {
    if (field.wireType == ProtobufWireType::Varint) {
        values.push_back(protobufInt32(field));
        return {};
    }
    if (field.wireType != ProtobufWireType::LengthDelimited) {
        return core::fail(core::FailureCode::InvalidModelFile, "protobuf_int32_wire_type:" + std::to_string(field.number));
    }
    std::size_t position = 0;
    while (position < field.payload.size()) {
        auto value = decodeVarint(field.payload, position);
        if (!value) {
            return std::unexpected(value.error());
        }
        values.push_back(static_cast<std::int32_t>(static_cast<std::uint32_t>(*value)));
    }
    return {};
}

core::Result<void> expectWireType(const ProtobufField& field, ProtobufWireType wireType, std::string_view context) {
    if (field.wireType != wireType) {
        return core::fail(core::FailureCode::InvalidModelFile, std::string(context) + ":" + std::to_string(field.number));
    }
    return {};
}

}
