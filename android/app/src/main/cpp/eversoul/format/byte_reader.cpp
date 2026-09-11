#include "eversoul/format/byte_reader.h"

namespace eversoul::format {

core::Result<float> readLittleEndianFloat32(ByteSpan bytes, std::size_t offset) {
    auto raw = readLittleEndian<std::uint32_t>(bytes, offset);
    if (!raw) {
        return std::unexpected(raw.error());
    }
    return std::bit_cast<float>(*raw);
}

core::Result<ByteSpan> sliceBytes(ByteSpan bytes, std::size_t offset, std::size_t length) {
    if (offset > bytes.size() || bytes.size() - offset < length) {
        return core::fail(core::FailureCode::InvalidModelFile, "slice_out_of_bounds:" + std::to_string(offset));
    }
    return bytes.subspan(offset, length);
}

}
