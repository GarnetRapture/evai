#pragma once

#include <chat.h>
#include <llama.h>

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <string_view>
#include <vector>

namespace evai::android::llama {

struct ChatMessage {
    std::string role;
    std::string content;
};

struct SamplingParameters {
    std::int32_t top_k;
    float top_p;
    float temperature;
    std::uint32_t seed;
};

struct GenerationRequest {
    std::vector<ChatMessage> messages;
    std::string grammar;
    std::int32_t max_output_tokens;
    SamplingParameters sampling;
};

struct GenerationResult {
    std::string text;
    bool cancelled;
    std::int32_t prompt_tokens;
    std::int32_t reused_prefix_tokens;
    std::int32_t generated_tokens;
    std::int32_t cached_tokens;
    bool cache_reset;
};

struct PrefillResult {
    bool cancelled;
    std::int32_t prompt_tokens;
    std::int32_t reused_prefix_tokens;
    std::int32_t cached_tokens;
    bool cache_reset;
};

struct ModelState {
    bool loaded;
    std::string file_path;
    std::int32_t context_window;
    std::int32_t maximum_context_window;
    std::string description;
};

using TextSink = std::function<void(std::string_view)>;

class LlamaEngine {
public:
    LlamaEngine();
    ~LlamaEngine();
    LlamaEngine(const LlamaEngine&) = delete;
    LlamaEngine& operator=(const LlamaEngine&) = delete;
    LlamaEngine(LlamaEngine&&) = delete;
    LlamaEngine& operator=(LlamaEngine&&) = delete;

    ModelState load(const std::string& file_path, std::int32_t requested_context);
    void unload();
    [[nodiscard]] ModelState state();
    [[nodiscard]] std::int32_t measure(const std::vector<ChatMessage>& messages, bool add_assistant);
    PrefillResult prefill(const std::vector<ChatMessage>& messages);
    GenerationResult generate(const GenerationRequest& request, const TextSink& sink);
    void clear_cancel();
    void cancel();

private:
    struct ModelDeleter {
        void operator()(llama_model* model) const noexcept;
    };
    struct ContextDeleter {
        void operator()(llama_context* context) const noexcept;
    };
    struct SamplerDeleter {
        void operator()(llama_sampler* sampler) const noexcept;
    };
    using SamplerHandle = std::unique_ptr<llama_sampler, SamplerDeleter>;

    static bool abort_requested(void* engine);

    void require_loaded() const;
    [[nodiscard]] ModelState describe() const;
    [[nodiscard]] std::string render(const std::vector<ChatMessage>& messages, bool add_assistant) const;
    [[nodiscard]] std::vector<llama_token> tokenize(std::string_view text) const;
    [[nodiscard]] std::string piece(llama_token token) const;
    PrefillResult synchronize(const std::vector<llama_token>& tokens);
    bool decode_tokens(std::vector<llama_token>& tokens, std::size_t begin);
    [[nodiscard]] SamplerHandle create_chain(const SamplingParameters& sampling) const;
    [[nodiscard]] SamplerHandle create_grammar(const std::string& grammar) const;
    llama_token sample(llama_sampler* chain, llama_sampler* grammar, std::vector<llama_token_data>& candidates);
    void forget_cache();

    std::mutex mutex_;
    std::atomic_bool cancel_requested_;
    std::unique_ptr<llama_model, ModelDeleter> model_;
    std::unique_ptr<llama_context, ContextDeleter> context_;
    common_chat_templates_ptr templates_;
    std::string file_path_;
    std::int32_t context_window_;
    std::int32_t batch_tokens_;
    std::vector<llama_token> cached_tokens_;
};

}
