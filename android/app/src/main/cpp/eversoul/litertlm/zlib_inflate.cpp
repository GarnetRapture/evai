#include "eversoul/litertlm/zlib_inflate.h"

#include <cstdint>
#include <cstring>

#include <zlib.h>

namespace eversoul::litertlm {
namespace {

constexpr std::size_t kUncompressedSizePrefix = sizeof(std::uint64_t);
constexpr std::uint64_t kMaxUncompressedBytes = 1ULL << 30;

}

core::Result<std::string> inflateHuggingFaceTokenizer(format::ByteSpan compressed) {
    if (compressed.size() < kUncompressedSizePrefix) {
        return core::fail(core::FailureCode::InvalidModelFile, "hf_tokenizer_prefix_truncated");
    }
    std::uint64_t uncompressedSize = 0;
    std::memcpy(&uncompressedSize, compressed.data(), kUncompressedSizePrefix);
    if (uncompressedSize == 0 || uncompressedSize > kMaxUncompressedBytes) {
        return core::fail(core::FailureCode::InvalidModelFile, "hf_tokenizer_size_invalid");
    }
    std::string output(static_cast<std::size_t>(uncompressedSize), '\0');
    uLongf destinationLength = static_cast<uLongf>(uncompressedSize);
    const auto* source = reinterpret_cast<const Bytef*>(compressed.data()) + kUncompressedSizePrefix;
    const auto sourceLength = static_cast<uLong>(compressed.size() - kUncompressedSizePrefix);
    const int result = ::uncompress(reinterpret_cast<Bytef*>(output.data()), &destinationLength, source, sourceLength);
    if (result != Z_OK) {
        return core::fail(core::FailureCode::InvalidModelFile, "hf_tokenizer_inflate_failed:" + std::to_string(result));
    }
    output.resize(static_cast<std::size_t>(destinationLength));
    return output;
}

}
