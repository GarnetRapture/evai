#include "jni/jni_text.hpp"

#include <cstddef>
#include <limits>
#include <stdexcept>
#include <string>
#include <string_view>

namespace evai::android::jni {

const char* PendingJavaException::what() const noexcept
{
    return "a Java exception is pending";
}

std::string read_utf8(JNIEnv* env, jbyteArray bytes)
{
    if (bytes == nullptr) {
        throw std::invalid_argument("required UTF-8 payload is missing");
    }
    const jsize length = env->GetArrayLength(bytes);
    std::string text(static_cast<std::size_t>(length), '\0');
    if (length > 0) {
        env->GetByteArrayRegion(bytes, 0, length, reinterpret_cast<jbyte*>(text.data()));
    }
    if (env->ExceptionCheck() == JNI_TRUE) {
        throw PendingJavaException();
    }
    return text;
}

jbyteArray make_utf8(JNIEnv* env, std::string_view text)
{
    if (text.size() > static_cast<std::size_t>(std::numeric_limits<jsize>::max())) {
        throw std::length_error("UTF-8 payload exceeds the Java array limit");
    }
    const auto length = static_cast<jsize>(text.size());
    jbyteArray bytes = env->NewByteArray(length);
    if (bytes == nullptr) {
        throw PendingJavaException();
    }
    if (length > 0) {
        env->SetByteArrayRegion(bytes, 0, length, reinterpret_cast<const jbyte*>(text.data()));
    }
    if (env->ExceptionCheck() == JNI_TRUE) {
        throw PendingJavaException();
    }
    return bytes;
}

void throw_java(JNIEnv* env, const char* class_name, std::string_view message)
{
    if (env->ExceptionCheck() == JNI_TRUE) {
        return;
    }
    jclass type = env->FindClass(class_name);
    if (type == nullptr) {
        return;
    }
    const std::string text(message);
    env->ThrowNew(type, text.c_str());
    env->DeleteLocalRef(type);
}

void throw_current(JNIEnv* env, const char* class_name)
{
    try {
        throw;
    }
    catch (const PendingJavaException&) {
    }
    catch (const std::exception& error) {
        throw_java(env, class_name, error.what());
    }
    catch (...) {
        throw_java(env, class_name, "unknown native failure");
    }
}

}
