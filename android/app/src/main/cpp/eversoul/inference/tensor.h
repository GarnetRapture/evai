#pragma once

#include <cstddef>
#include <cstdint>
#include <span>
#include <string>
#include <string_view>
#include <vector>

#include "eversoul/core/failure.h"

namespace eversoul::inference {

enum class TensorElementType : std::uint8_t {
    Float32,
    Float16,
    Int32,
    Bool,
};

struct TensorShape {
    std::vector<std::int32_t> dimensions;

    [[nodiscard]] std::int64_t elementCount() const noexcept;
};

[[nodiscard]] std::size_t elementByteSize(TensorElementType type) noexcept;

struct ModelSignatureNames {
    std::string inputTokens;
    std::string inputPositions;
    std::string inputMask;
    std::string inputLocalMask;
    std::string outputLogits;
};

class CompiledGraph {
public:
    virtual ~CompiledGraph() = default;

    [[nodiscard]] virtual std::vector<std::string> signatureKeys() const = 0;
    [[nodiscard]] virtual core::Result<ModelSignatureNames> signatureIo(std::string_view signature) const = 0;
    [[nodiscard]] virtual core::Result<TensorShape> inputShape(std::string_view signature, std::string_view tensor) const = 0;
    [[nodiscard]] virtual core::Result<TensorElementType> inputType(std::string_view signature, std::string_view tensor) const = 0;
    [[nodiscard]] virtual core::Result<TensorElementType> outputType(std::string_view signature, std::string_view tensor) const = 0;
    [[nodiscard]] virtual core::Result<std::int32_t> vocabSize(std::string_view signature) const = 0;

    [[nodiscard]] virtual core::Result<void> writeInputInt32(std::string_view signature, std::string_view tensor, std::span<const std::int32_t> values) = 0;
    [[nodiscard]] virtual core::Result<void> writeInputFloat(std::string_view signature, std::string_view tensor, std::span<const float> values) = 0;
    [[nodiscard]] virtual core::Result<void> writeInputBool(std::string_view signature, std::string_view tensor, std::span<const std::uint8_t> values) = 0;
    [[nodiscard]] virtual core::Result<void> run(std::string_view signature) = 0;
    [[nodiscard]] virtual core::Result<std::span<const float>> readOutputFloat(std::string_view signature, std::string_view tensor) = 0;
};

}
