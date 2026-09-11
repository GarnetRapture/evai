#pragma once

#include <string>

#include "eversoul/core/failure.h"
#include "eversoul/format/byte_reader.h"

namespace eversoul::litertlm {

[[nodiscard]] core::Result<std::string> inflateHuggingFaceTokenizer(format::ByteSpan compressed);

}
