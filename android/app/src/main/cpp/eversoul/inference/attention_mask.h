#pragma once

#include <cstdint>
#include <vector>

#include "eversoul/inference/tensor.h"

namespace eversoul::inference {

struct AttentionMaskLayout {
    std::int32_t queryLength;
    std::int32_t contextLength;
};

class AttentionMaskBuilder {
public:
    explicit AttentionMaskBuilder(std::int32_t slidingWindow) noexcept;

    [[nodiscard]] std::vector<float> buildFloatMask(std::int32_t startPosition, const AttentionMaskLayout& layout) const;
    [[nodiscard]] std::vector<std::uint8_t> buildBoolMask(std::int32_t startPosition, const AttentionMaskLayout& layout) const;

private:
    [[nodiscard]] bool attends(std::int32_t queryPosition, std::int32_t keyPosition) const noexcept;

    std::int32_t slidingWindow_;
};

}
