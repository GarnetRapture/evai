#pragma once

#include <memory>

#include "eversoul/core/failure.h"
#include "eversoul/format/byte_reader.h"
#include "eversoul/litertlm/container.h"
#include "eversoul/tokenizer/tokenizer.h"
#include "eversoul/unicode/code_point_category.h"

namespace eversoul::tokenizer {

[[nodiscard]] core::Result<std::unique_ptr<Tokenizer>> buildTokenizer(
    format::ByteSpan modelFile,
    const litertlm::ContainerIndex& index,
    std::shared_ptr<const unicode::CodePointClassifier> classifier);

}
