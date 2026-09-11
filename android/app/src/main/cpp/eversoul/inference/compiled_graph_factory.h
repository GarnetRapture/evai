#pragma once

#include <memory>
#include <string>

#include "eversoul/core/failure.h"
#include "eversoul/format/byte_reader.h"
#include "eversoul/inference/tensor.h"

namespace eversoul::inference {

enum class ComputeBackend {
    Gpu,
    Cpu,
};

struct CompiledGraphOptions {
    ComputeBackend backend;
    std::int32_t maxContextTokens;
    std::string cacheDirectory;
};

[[nodiscard]] core::Result<std::unique_ptr<CompiledGraph>> createLiteRtCompiledGraph(
    format::ByteSpan tfliteModel, const CompiledGraphOptions& options);

}
