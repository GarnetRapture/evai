#include "eversoul/inference/attention_mask.h"

#include <limits>

namespace eversoul::inference {
namespace {

constexpr std::int32_t kNoSlidingWindow = 0;

}

AttentionMaskBuilder::AttentionMaskBuilder(std::int32_t slidingWindow) noexcept : slidingWindow_(slidingWindow) {}

bool AttentionMaskBuilder::attends(std::int32_t queryPosition, std::int32_t keyPosition) const noexcept {
    if (keyPosition > queryPosition) {
        return false;
    }
    if (slidingWindow_ > kNoSlidingWindow && queryPosition - keyPosition >= slidingWindow_) {
        return false;
    }
    return true;
}

std::vector<float> AttentionMaskBuilder::buildFloatMask(std::int32_t startPosition, const AttentionMaskLayout& layout) const {
    const std::int64_t elements = static_cast<std::int64_t>(layout.queryLength) * layout.contextLength;
    std::vector<float> mask(static_cast<std::size_t>(elements), -std::numeric_limits<float>::infinity());
    for (std::int32_t query = 0; query < layout.queryLength; ++query) {
        const std::int32_t queryPosition = startPosition + query;
        float* row = mask.data() + static_cast<std::size_t>(query) * layout.contextLength;
        for (std::int32_t key = 0; key < layout.contextLength && key <= queryPosition; ++key) {
            if (attends(queryPosition, key)) {
                row[key] = 0.0F;
            }
        }
    }
    return mask;
}

std::vector<std::uint8_t> AttentionMaskBuilder::buildBoolMask(std::int32_t startPosition, const AttentionMaskLayout& layout) const {
    const std::int64_t elements = static_cast<std::int64_t>(layout.queryLength) * layout.contextLength;
    std::vector<std::uint8_t> mask(static_cast<std::size_t>(elements), 0);
    for (std::int32_t query = 0; query < layout.queryLength; ++query) {
        const std::int32_t queryPosition = startPosition + query;
        std::uint8_t* row = mask.data() + static_cast<std::size_t>(query) * layout.contextLength;
        for (std::int32_t key = 0; key < layout.contextLength && key <= queryPosition; ++key) {
            if (attends(queryPosition, key)) {
                row[key] = 1;
            }
        }
    }
    return mask;
}

}
