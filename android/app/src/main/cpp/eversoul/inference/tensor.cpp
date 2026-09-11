#include "eversoul/inference/tensor.h"

namespace eversoul::inference {

std::int64_t TensorShape::elementCount() const noexcept {
    std::int64_t count = 1;
    for (const std::int32_t dimension : dimensions) {
        if (dimension <= 0) {
            return 0;
        }
        count *= dimension;
    }
    return count;
}

std::size_t elementByteSize(TensorElementType type) noexcept {
    switch (type) {
        case TensorElementType::Float32:
        case TensorElementType::Int32:
            return 4;
        case TensorElementType::Float16:
            return 2;
        case TensorElementType::Bool:
            return 1;
    }
    return 0;
}

}
