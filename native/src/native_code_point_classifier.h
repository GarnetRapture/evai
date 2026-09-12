#pragma once

#include "eversoul/unicode/code_point_category.h"

namespace eversoul::native {

class NativeCodePointClassifier final : public unicode::CodePointClassifier {
public:
    [[nodiscard]] unicode::CodePointCategory categoryOf(char32_t codePoint) const override;
};

}
