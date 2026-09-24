#include <jni.h>
#include <llama.h>

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace {

struct ModelDeleter {
    void operator()(llama_model* model) const noexcept {
        if (model != nullptr) llama_model_free(model);
    }
};

struct ContextDeleter {
    void operator()(llama_context* context) const noexcept {
        if (context != nullptr) llama_free(context);
    }
};

struct SamplerDeleter {
    void operator()(llama_sampler* sampler) const noexcept {
        if (sampler != nullptr) llama_sampler_free(sampler);
    }
};

struct ModelSession {
    std::unique_ptr<llama_model, ModelDeleter> model;
    std::unique_ptr<llama_context, ContextDeleter> context;
    int32_t context_tokens;
    int32_t batch_tokens;
};

std::mutex session_mutex;
std::unique_ptr<ModelSession> session;
std::once_flag backend_once;
std::atomic_bool cancellation_requested{false};

std::string utf8(JNIEnv* env, jbyteArray value) {
    if (value == nullptr) throw std::invalid_argument("Required text is missing");
    const jsize length = env->GetArrayLength(value);
    std::string result(static_cast<size_t>(length), '\0');
    if (length > 0) env->GetByteArrayRegion(value, 0, length, reinterpret_cast<jbyte*>(result.data()));
    if (env->ExceptionCheck()) throw std::runtime_error("Cannot read Java bytes");
    return result;
}

jbyteArray java_bytes(JNIEnv* env, const std::string& value) {
    if (value.size() > static_cast<size_t>(std::numeric_limits<jsize>::max())) {
        throw std::runtime_error("Generated text is too large for Java");
    }
    const auto length = static_cast<jsize>(value.size());
    jbyteArray result = env->NewByteArray(length);
    if (result == nullptr) throw std::runtime_error("Cannot allocate Java response");
    if (length > 0) env->SetByteArrayRegion(result, 0, length, reinterpret_cast<const jbyte*>(value.data()));
    return result;
}

void reject(JNIEnv* env, const char* message) {
    jclass error_type = env->FindClass("java/lang/IllegalStateException");
    if (error_type != nullptr) env->ThrowNew(error_type, message);
}

std::vector<llama_token> tokenize(const llama_vocab* vocab, const std::string& prompt) {
    if (prompt.size() > static_cast<size_t>(std::numeric_limits<int32_t>::max())) {
        throw std::invalid_argument("Prompt exceeds tokenizer input limit");
    }
    const auto input_length = static_cast<int32_t>(prompt.size());
    const int32_t needed = llama_tokenize(vocab, prompt.data(), input_length, nullptr, 0, true, true);
    if (needed == std::numeric_limits<int32_t>::min()) {
        throw std::runtime_error("Prompt tokenization overflowed");
    }
    std::vector<llama_token> tokens(static_cast<size_t>(std::abs(needed)));
    const int32_t count = llama_tokenize(vocab, prompt.data(), input_length, tokens.data(), static_cast<int32_t>(tokens.size()), true, true);
    if (count <= 0) throw std::runtime_error("Prompt tokenization failed");
    tokens.resize(static_cast<size_t>(count));
    return tokens;
}

std::string token_piece(const llama_vocab* vocab, llama_token token) {
    char buffer[256];
    int32_t size = llama_token_to_piece(vocab, token, buffer, static_cast<int32_t>(sizeof(buffer)), 0, false);
    if (size < 0) {
        std::string output(static_cast<size_t>(-size), '\0');
        size = llama_token_to_piece(vocab, token, output.data(), static_cast<int32_t>(output.size()), 0, false);
        if (size < 0) throw std::runtime_error("Token conversion failed");
        output.resize(static_cast<size_t>(size));
        return output;
    }
    return std::string(buffer, static_cast<size_t>(size));
}

void decode(llama_context* context, llama_token* tokens, int32_t count) {
    auto batch = llama_batch_get_one(tokens, count);
    if (llama_decode(context, batch) != 0) throw std::runtime_error("Model decoding failed");
}

std::string apply_chat_template(llama_model* model, const std::vector<llama_chat_message>& messages) {
    const char* format = llama_model_chat_template(model, nullptr);
    if (format == nullptr) throw std::runtime_error("GGUF model has no chat template");
    const int32_t count = static_cast<int32_t>(messages.size());
    const int32_t needed = llama_chat_apply_template(format, messages.data(), count, true, nullptr, 0);
    if (needed <= 0) throw std::runtime_error("GGUF chat template failed");
    std::string prompt(static_cast<size_t>(needed) + 1, '\0');
    const int32_t written = llama_chat_apply_template(format, messages.data(), count, true, prompt.data(), static_cast<int32_t>(prompt.size()));
    if (written <= 0 || written > needed) throw std::runtime_error("GGUF chat template output failed");
    prompt.resize(static_cast<size_t>(written));
    return prompt;
}

std::string generate(ModelSession& active, const std::vector<llama_chat_message>& messages, int32_t max_tokens) {
    const std::string prompt = apply_chat_template(active.model.get(), messages);
    const llama_vocab* vocab = llama_model_get_vocab(active.model.get());
    auto tokens = tokenize(vocab, prompt);
    if (tokens.size() + static_cast<size_t>(max_tokens) > static_cast<size_t>(active.context_tokens)) {
        throw std::invalid_argument("Prompt and output exceed model context");
    }
    llama_memory_clear(llama_get_memory(active.context.get()), true);
    cancellation_requested.store(false);
    for (size_t offset = 0; offset < tokens.size(); offset += static_cast<size_t>(active.batch_tokens)) {
        if (cancellation_requested.load()) throw std::runtime_error("Generation cancelled");
        const auto count = static_cast<int32_t>(std::min(tokens.size() - offset, static_cast<size_t>(active.batch_tokens)));
        decode(active.context.get(), tokens.data() + offset, count);
    }

    std::unique_ptr<llama_sampler, SamplerDeleter> sampler(llama_sampler_chain_init(llama_sampler_chain_default_params()));
    if (!sampler) throw std::runtime_error("Sampling initialization failed");
    llama_sampler_chain_add(sampler.get(), llama_sampler_init_top_k(40));
    llama_sampler_chain_add(sampler.get(), llama_sampler_init_top_p(0.9f, 1));
    llama_sampler_chain_add(sampler.get(), llama_sampler_init_temp(0.8f));
    llama_sampler_chain_add(sampler.get(), llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    std::string output;
    for (int32_t index = 0; index < max_tokens; ++index) {
        if (cancellation_requested.load()) throw std::runtime_error("Generation cancelled");
        llama_token token = llama_sampler_sample(sampler.get(), active.context.get(), -1);
        if (llama_vocab_is_eog(vocab, token)) break;
        output += token_piece(vocab, token);
        decode(active.context.get(), &token, 1);
    }
    return output;
}

}

extern "C" JNIEXPORT jstring JNICALL
Java_evai_android_EvaiNativeModule_nativeLoadModel(JNIEnv* env, jobject, jbyteArray path, jint context_tokens) {
    try {
        const std::string model_path = utf8(env, path);
        std::lock_guard lock(session_mutex);
        std::call_once(backend_once, llama_backend_init);
        session.reset();
        cancellation_requested.store(false);
        auto params = llama_model_default_params();
        params.n_gpu_layers = 0;
        std::unique_ptr<llama_model, ModelDeleter> model(llama_model_load_from_file(model_path.c_str(), params));
        if (!model) throw std::runtime_error("GGUF model could not be loaded");
        auto context_params = llama_context_default_params();
        context_params.n_ctx = static_cast<uint32_t>(context_tokens);
        context_params.n_batch = static_cast<uint32_t>(std::min(context_tokens, 512));
        context_params.n_ubatch = context_params.n_batch;
        context_params.n_threads = static_cast<int32_t>(std::clamp(std::thread::hardware_concurrency(), 1u, 4u));
        std::unique_ptr<llama_context, ContextDeleter> context(llama_init_from_model(model.get(), context_params));
        if (!context) throw std::runtime_error("GGUF context could not be created");
        session = std::make_unique<ModelSession>(std::move(model), std::move(context), context_tokens, static_cast<int32_t>(context_params.n_batch));
        return env->NewStringUTF(llama_version());
    } catch (const std::exception& error) {
        reject(env, error.what());
        return nullptr;
    }
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_evai_android_EvaiNativeModule_nativeGenerate(JNIEnv* env, jobject, jobjectArray roles, jobjectArray contents, jint max_tokens) {
    try {
        const jsize count = env->GetArrayLength(roles);
        if (count <= 0) throw std::invalid_argument("Chat messages are missing");
        if (env->GetArrayLength(contents) != count) throw std::invalid_argument("Chat message arrays disagree");
        std::vector<std::string> role_storage;
        std::vector<std::string> content_storage;
        role_storage.reserve(static_cast<size_t>(count));
        content_storage.reserve(static_cast<size_t>(count));
        for (jsize index = 0; index < count; ++index) {
            jstring role = static_cast<jstring>(env->GetObjectArrayElement(roles, index));
            if (role == nullptr) throw std::invalid_argument("Chat message role is missing");
            const char* role_chars = env->GetStringUTFChars(role, nullptr);
            if (role_chars == nullptr) throw std::runtime_error("Cannot read chat message role");
            role_storage.emplace_back(role_chars);
            env->ReleaseStringUTFChars(role, role_chars);
            env->DeleteLocalRef(role);
            jbyteArray content = static_cast<jbyteArray>(env->GetObjectArrayElement(contents, index));
            if (content == nullptr) throw std::invalid_argument("Chat message content is missing");
            content_storage.emplace_back(utf8(env, content));
            env->DeleteLocalRef(content);
        }
        for (const std::string& role : role_storage) {
            if (role != "system" && role != "user" && role != "assistant") {
                throw std::invalid_argument("Invalid chat message role");
            }
        }
        if (role_storage.front() != "system" || role_storage.back() != "user") {
            throw std::invalid_argument("Chat messages must open with the system prompt and close with the user turn");
        }
        std::vector<llama_chat_message> messages;
        messages.reserve(role_storage.size());
        for (size_t index = 0; index < role_storage.size(); ++index) {
            messages.push_back({role_storage[index].c_str(), content_storage[index].c_str()});
        }
        std::lock_guard lock(session_mutex);
        if (!session) throw std::runtime_error("No GGUF model is loaded");
        const std::string output = generate(*session, messages, max_tokens);
        return java_bytes(env, output);
    } catch (const std::exception& error) {
        reject(env, error.what());
        return nullptr;
    }
}

extern "C" JNIEXPORT void JNICALL
Java_evai_android_EvaiNativeModule_nativeCancel(JNIEnv*, jobject) {
    cancellation_requested.store(true);
}

extern "C" JNIEXPORT void JNICALL
Java_evai_android_EvaiNativeModule_nativeUnload(JNIEnv*, jobject) {
    std::lock_guard lock(session_mutex);
    session.reset();
}
