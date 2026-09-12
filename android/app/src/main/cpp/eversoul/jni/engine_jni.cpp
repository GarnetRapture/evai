#include <jni.h>

#include <atomic>
#include <memory>
#include <string>
#include <vector>

#include "eversoul/format/json_value.h"
#include "eversoul/inference/chat_prompt.h"
#include "eversoul/inference/compiled_graph_factory.h"
#include "eversoul/inference/engine.h"
#include "eversoul/jni/code_point_classifier_jni.h"

namespace {

using eversoul::inference::ChatPrompt;
using eversoul::inference::ChatRole;
using eversoul::inference::ChatTurn;
using eversoul::inference::ComputeBackend;
using eversoul::inference::LiteRtLmEngine;

JavaVM* g_javaVm = nullptr;
std::shared_ptr<eversoul::jni::JavaCodePointClassifier> g_classifier;

struct EngineHandle {
    std::unique_ptr<LiteRtLmEngine> engine;
    std::atomic<bool> cancelled{false};
};

std::string toStdString(JNIEnv* env, jstring value) {
    if (value == nullptr) {
        return {};
    }
    const char* chars = env->GetStringUTFChars(value, nullptr);
    std::string result(chars != nullptr ? chars : "");
    if (chars != nullptr) {
        env->ReleaseStringUTFChars(value, chars);
    }
    return result;
}

ChatRole roleFromString(std::string_view role) {
    if (role == "assistant" || role == "model") {
        return ChatRole::Model;
    }
    if (role == "system") {
        return ChatRole::System;
    }
    return ChatRole::User;
}

eversoul::core::Result<ChatPrompt> parseChatPrompt(
    const std::string& systemPrompt,
    const std::string& historyJson,
    const std::string& userMessage,
    const std::string& responsePrefix) {
    ChatPrompt prompt;
    prompt.systemPrompt = systemPrompt;
    prompt.userMessage = userMessage;
    prompt.responsePrefix = responsePrefix;
    if (historyJson.empty()) {
        return prompt;
    }
    auto parsed = eversoul::format::parseJson(historyJson);
    if (!parsed) {
        return std::unexpected(parsed.error());
    }
    auto array = parsed->asArray();
    if (!array) {
        return std::unexpected(array.error());
    }
    for (const eversoul::format::JsonValue& entry : **array) {
        const eversoul::format::JsonValue* role = entry.find("role");
        const eversoul::format::JsonValue* content = entry.find("content");
        if (role == nullptr || content == nullptr) {
            continue;
        }
        auto roleText = role->asString();
        auto contentText = content->asString();
        if (!roleText || !contentText) {
            continue;
        }
        prompt.history.push_back(ChatTurn{roleFromString(*roleText), std::string(*contentText)});
    }
    return prompt;
}

}

extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* /*reserved*/) {
    g_javaVm = vm;
    g_classifier = std::make_shared<eversoul::jni::JavaCodePointClassifier>(vm);
    return JNI_VERSION_1_6;
}

extern "C" JNIEXPORT jlong JNICALL
Java_pro_everlib_ai_llm_EverSoulLlmJni_nativeLoad(JNIEnv* env, jclass /*clazz*/, jstring modelPath, jint backend, jstring cacheDir) {
    eversoul::inference::CompiledGraphOptions options{
        backend == 0 ? ComputeBackend::Gpu : ComputeBackend::Cpu,
        0,
        toStdString(env, cacheDir),
    };
    auto engine = LiteRtLmEngine::load(toStdString(env, modelPath), options, g_classifier);
    if (!engine) {
        return 0;
    }
    auto* handle = new EngineHandle{std::move(*engine), {}};
    return reinterpret_cast<jlong>(handle);
}

extern "C" JNIEXPORT jint JNICALL
Java_pro_everlib_ai_llm_EverSoulLlmJni_nativeContextWindow(JNIEnv* /*env*/, jclass /*clazz*/, jlong handle) {
    auto* engineHandle = reinterpret_cast<EngineHandle*>(handle);
    return engineHandle != nullptr ? engineHandle->engine->contextWindow() : 0;
}

extern "C" JNIEXPORT void JNICALL
Java_pro_everlib_ai_llm_EverSoulLlmJni_nativeCancel(JNIEnv* /*env*/, jclass /*clazz*/, jlong handle) {
    auto* engineHandle = reinterpret_cast<EngineHandle*>(handle);
    if (engineHandle != nullptr) {
        engineHandle->cancelled.store(true, std::memory_order_relaxed);
    }
}

extern "C" JNIEXPORT void JNICALL
Java_pro_everlib_ai_llm_EverSoulLlmJni_nativeUnload(JNIEnv* /*env*/, jclass /*clazz*/, jlong handle) {
    delete reinterpret_cast<EngineHandle*>(handle);
}

extern "C" JNIEXPORT jstring JNICALL
Java_pro_everlib_ai_llm_EverSoulLlmJni_nativeGenerate(
    JNIEnv* env, jclass /*clazz*/, jlong handle, jstring systemPrompt, jstring historyJson,
    jstring userMessage, jstring responsePrefix, jint maxTokens, jobject chunkSink) {
    auto* engineHandle = reinterpret_cast<EngineHandle*>(handle);
    if (engineHandle == nullptr) {
        return env->NewStringUTF("{\"error\":\"native_runtime\",\"detail\":\"invalid_handle\"}");
    }
    engineHandle->cancelled.store(false, std::memory_order_relaxed);

    auto prompt = parseChatPrompt(
        toStdString(env, systemPrompt),
        toStdString(env, historyJson),
        toStdString(env, userMessage),
        toStdString(env, responsePrefix));
    if (!prompt) {
        return env->NewStringUTF("{\"error\":\"invalid_model_file\",\"detail\":\"prompt_parse\"}");
    }

    jclass sinkClass = env->GetObjectClass(chunkSink);
    jmethodID onChunk = env->GetMethodID(sinkClass, "onChunk", "(Ljava/lang/String;)V");

    const auto emit = [&](std::string_view chunk) {
        if (onChunk == nullptr) {
            return;
        }
        const std::string text(chunk);
        jstring javaChunk = env->NewStringUTF(text.c_str());
        env->CallVoidMethod(chunkSink, onChunk, javaChunk);
        env->DeleteLocalRef(javaChunk);
    };

    auto outcome = engineHandle->engine->generate(*prompt, maxTokens, emit, engineHandle->cancelled);
    if (!outcome) {
        const std::string code(eversoul::core::failureCodeName(outcome.error().code));
        const std::string body = "{\"error\":\"" + code + "\",\"detail\":\"" + outcome.error().detail + "\"}";
        return env->NewStringUTF(body.c_str());
    }
    const std::string status = outcome->cancelled ? "cancelled" : "ok";
    const std::string body = "{\"status\":\"" + status
        + "\",\"prompt_tokens\":" + std::to_string(outcome->promptTokens)
        + ",\"generated_tokens\":" + std::to_string(outcome->generatedTokens) + "}";
    return env->NewStringUTF(body.c_str());
}
