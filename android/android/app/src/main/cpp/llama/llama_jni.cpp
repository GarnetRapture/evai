#include "http/http_response.hpp"
#include "jni/jni_text.hpp"
#include "llama/llama_engine.hpp"

#include <jni.h>

#include <cstddef>
#include <cstdint>
#include <format>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

namespace {

constexpr const char* llama_failure_class = "evai/android/llm/LlamaFailure";
constexpr const char* text_sink_method = "accept";
constexpr const char* text_sink_signature = "([B)V";

evai::android::llama::LlamaEngine& engine()
{
    static evai::android::llama::LlamaEngine instance;
    return instance;
}

std::string json_text(std::string_view value)
{
    return std::format("\"{}\"", evai::server::http::json_escaped(value));
}

std::string_view json_flag(bool value)
{
    return value ? "true" : "false";
}

std::string serialize_state(const evai::android::llama::ModelState& state)
{
    return std::format(
        "{{\"loaded\":{},\"file_path\":{},\"context_window\":{},\"maximum_context_window\":{},\"description\":{}}}",
        json_flag(state.loaded),
        json_text(state.file_path),
        state.context_window,
        state.maximum_context_window,
        json_text(state.description));
}

std::string serialize_prefill(const evai::android::llama::PrefillResult& result)
{
    return std::format(
        "{{\"cancelled\":{},\"prompt_tokens\":{},\"reused_prefix_tokens\":{},\"cached_tokens\":{},\"cache_reset\":{}}}",
        json_flag(result.cancelled),
        result.prompt_tokens,
        result.reused_prefix_tokens,
        result.cached_tokens,
        json_flag(result.cache_reset));
}

std::string serialize_generation(const evai::android::llama::GenerationResult& result)
{
    return std::format(
        "{{\"text\":{},\"cancelled\":{},\"prompt_tokens\":{},\"reused_prefix_tokens\":{},\"generated_tokens\":{},\"cached_tokens\":{},\"cache_reset\":{}}}",
        json_text(result.text),
        json_flag(result.cancelled),
        result.prompt_tokens,
        result.reused_prefix_tokens,
        result.generated_tokens,
        result.cached_tokens,
        json_flag(result.cache_reset));
}

std::string read_role(JNIEnv* env, jobjectArray roles, jsize index)
{
    auto* role = static_cast<jstring>(env->GetObjectArrayElement(roles, index));
    if (role == nullptr) {
        throw std::invalid_argument(std::format("chat message {} has no role", index));
    }
    const char* characters = env->GetStringUTFChars(role, nullptr);
    if (characters == nullptr) {
        env->DeleteLocalRef(role);
        throw evai::android::jni::PendingJavaException();
    }
    std::string value(characters);
    env->ReleaseStringUTFChars(role, characters);
    env->DeleteLocalRef(role);
    if (value != "system" && value != "user" && value != "assistant") {
        throw std::invalid_argument(std::format("chat message {} has an unknown role {}", index, value));
    }
    return value;
}

std::vector<evai::android::llama::ChatMessage> read_messages(JNIEnv* env, jobjectArray roles, jobjectArray contents)
{
    if (roles == nullptr || contents == nullptr) {
        throw std::invalid_argument("chat messages are missing");
    }
    const jsize count = env->GetArrayLength(roles);
    if (env->GetArrayLength(contents) != count) {
        throw std::invalid_argument("chat message roles and contents disagree");
    }
    std::vector<evai::android::llama::ChatMessage> messages;
    messages.reserve(static_cast<std::size_t>(count));
    for (jsize index = 0; index < count; index += 1) {
        std::string role = read_role(env, roles, index);
        auto* content = static_cast<jbyteArray>(env->GetObjectArrayElement(contents, index));
        std::string text = evai::android::jni::read_utf8(env, content);
        env->DeleteLocalRef(content);
        messages.push_back(evai::android::llama::ChatMessage{std::move(role), std::move(text)});
    }
    return messages;
}

class JavaTextSink {
public:
    JavaTextSink(JNIEnv* env, jobject sink)
        : env_(env)
        , sink_(sink)
        , method_(nullptr)
    {
        if (sink_ == nullptr) {
            throw std::invalid_argument("text sink is missing");
        }
        jclass type = env_->GetObjectClass(sink_);
        method_ = env_->GetMethodID(type, text_sink_method, text_sink_signature);
        env_->DeleteLocalRef(type);
        if (method_ == nullptr) {
            throw evai::android::jni::PendingJavaException();
        }
    }

    void operator()(std::string_view chunk) const
    {
        jbyteArray bytes = evai::android::jni::make_utf8(env_, chunk);
        env_->CallVoidMethod(sink_, method_, bytes);
        env_->DeleteLocalRef(bytes);
        if (env_->ExceptionCheck() == JNI_TRUE) {
            throw evai::android::jni::PendingJavaException();
        }
    }

private:
    JNIEnv* env_;
    jobject sink_;
    jmethodID method_;
};

}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_evai_android_llm_LlamaEngine_nativeLoad(JNIEnv* env, jobject, jbyteArray model_path, jint requested_context)
{
    try {
        const evai::android::llama::ModelState state = engine().load(evai::android::jni::read_utf8(env, model_path), requested_context);
        return evai::android::jni::make_utf8(env, serialize_state(state));
    }
    catch (...) {
        evai::android::jni::throw_current(env, llama_failure_class);
        return nullptr;
    }
}

extern "C" JNIEXPORT void JNICALL
Java_evai_android_llm_LlamaEngine_nativeUnload(JNIEnv* env, jobject)
{
    try {
        engine().unload();
    }
    catch (...) {
        evai::android::jni::throw_current(env, llama_failure_class);
    }
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_evai_android_llm_LlamaEngine_nativeState(JNIEnv* env, jobject)
{
    try {
        return evai::android::jni::make_utf8(env, serialize_state(engine().state()));
    }
    catch (...) {
        evai::android::jni::throw_current(env, llama_failure_class);
        return nullptr;
    }
}

extern "C" JNIEXPORT jint JNICALL
Java_evai_android_llm_LlamaEngine_nativeMeasure(JNIEnv* env, jobject, jobjectArray roles, jobjectArray contents, jboolean add_assistant)
{
    try {
        return engine().measure(read_messages(env, roles, contents), add_assistant == JNI_TRUE);
    }
    catch (...) {
        evai::android::jni::throw_current(env, llama_failure_class);
        return 0;
    }
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_evai_android_llm_LlamaEngine_nativePrefill(JNIEnv* env, jobject, jobjectArray roles, jobjectArray contents)
{
    try {
        const evai::android::llama::PrefillResult result = engine().prefill(read_messages(env, roles, contents));
        return evai::android::jni::make_utf8(env, serialize_prefill(result));
    }
    catch (...) {
        evai::android::jni::throw_current(env, llama_failure_class);
        return nullptr;
    }
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_evai_android_llm_LlamaEngine_nativeGenerate(
    JNIEnv* env,
    jobject,
    jobjectArray roles,
    jobjectArray contents,
    jbyteArray grammar,
    jint max_output_tokens,
    jint top_k,
    jfloat top_p,
    jfloat temperature,
    jlong seed,
    jobject sink)
{
    try {
        const evai::android::llama::GenerationRequest request{
            read_messages(env, roles, contents),
            evai::android::jni::read_utf8(env, grammar),
            max_output_tokens,
            evai::android::llama::SamplingParameters{top_k, top_p, temperature, static_cast<std::uint32_t>(seed)},
        };
        const JavaTextSink text_sink(env, sink);
        const evai::android::llama::GenerationResult result = engine().generate(request, text_sink);
        return evai::android::jni::make_utf8(env, serialize_generation(result));
    }
    catch (...) {
        evai::android::jni::throw_current(env, llama_failure_class);
        return nullptr;
    }
}

extern "C" JNIEXPORT void JNICALL
Java_evai_android_llm_LlamaEngine_nativeClearCancel(JNIEnv*, jobject)
{
    engine().clear_cancel();
}

extern "C" JNIEXPORT void JNICALL
Java_evai_android_llm_LlamaEngine_nativeCancel(JNIEnv*, jobject)
{
    engine().cancel();
}
