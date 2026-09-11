#include "eversoul/jni/code_point_classifier_jni.h"

namespace eversoul::jni {
namespace {

constexpr jint kUppercaseLetter = 1;
constexpr jint kLowercaseLetter = 2;
constexpr jint kTitlecaseLetter = 3;
constexpr jint kModifierLetter = 4;
constexpr jint kOtherLetter = 5;
constexpr jint kDecimalDigitNumber = 9;
constexpr jint kLetterNumber = 10;
constexpr jint kOtherNumber = 11;
constexpr jint kSpaceSeparator = 12;
constexpr jint kLineSeparator = 13;
constexpr jint kParagraphSeparator = 14;

unicode::CodePointCategory categoryFromJavaType(jint javaType) {
    switch (javaType) {
        case kUppercaseLetter:
        case kLowercaseLetter:
        case kTitlecaseLetter:
        case kModifierLetter:
        case kOtherLetter:
            return unicode::CodePointCategory::Letter;
        case kDecimalDigitNumber:
        case kLetterNumber:
        case kOtherNumber:
            return unicode::CodePointCategory::Number;
        case kSpaceSeparator:
        case kLineSeparator:
        case kParagraphSeparator:
            return unicode::CodePointCategory::Whitespace;
        default:
            return unicode::CodePointCategory::Other;
    }
}

}

JavaCodePointClassifier::JavaCodePointClassifier(JavaVM* vm) : vm_(vm) {}

unicode::CodePointCategory JavaCodePointClassifier::categoryOf(char32_t codePoint) const {
    const auto cached = cache_.find(codePoint);
    if (cached != cache_.end()) {
        return cached->second;
    }
    JNIEnv* env = nullptr;
    if (vm_->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK || env == nullptr) {
        return unicode::CodePointCategory::Other;
    }
    static jclass characterClass = reinterpret_cast<jclass>(env->NewGlobalRef(env->FindClass("java/lang/Character")));
    static jmethodID getTypeMethod = env->GetStaticMethodID(characterClass, "getType", "(I)I");
    if (characterClass == nullptr || getTypeMethod == nullptr) {
        return unicode::CodePointCategory::Other;
    }
    const jint javaType = env->CallStaticIntMethod(characterClass, getTypeMethod, static_cast<jint>(codePoint));
    const unicode::CodePointCategory category = categoryFromJavaType(javaType);
    cache_.emplace(codePoint, category);
    return category;
}

}
