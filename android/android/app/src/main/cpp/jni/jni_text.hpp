#pragma once

#include <jni.h>

#include <exception>
#include <string>
#include <string_view>

namespace evai::android::jni {

class PendingJavaException : public std::exception {
public:
    [[nodiscard]] const char* what() const noexcept override;
};

[[nodiscard]] std::string read_utf8(JNIEnv* env, jbyteArray bytes);
[[nodiscard]] jbyteArray make_utf8(JNIEnv* env, std::string_view text);
void throw_java(JNIEnv* env, const char* class_name, std::string_view message);
void throw_current(JNIEnv* env, const char* class_name);

}
