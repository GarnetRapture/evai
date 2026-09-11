#pragma once

#include <jni.h>

#include <memory>
#include <unordered_map>

#include "eversoul/unicode/code_point_category.h"

namespace eversoul::jni {

class JavaCodePointClassifier final : public unicode::CodePointClassifier {
public:
    explicit JavaCodePointClassifier(JavaVM* vm);

    [[nodiscard]] unicode::CodePointCategory categoryOf(char32_t codePoint) const override;

private:
    JavaVM* vm_;
    mutable std::unordered_map<char32_t, unicode::CodePointCategory> cache_;
};

}
