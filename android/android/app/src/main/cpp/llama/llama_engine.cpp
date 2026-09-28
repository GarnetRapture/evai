#include "llama/llama_engine.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <format>
#include <limits>
#include <mutex>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>
#include <utility>
#include <vector>

namespace evai::android::llama {

namespace {

constexpr std::int32_t minimum_context_tokens = 512;
constexpr std::int32_t maximum_batch_tokens = 512;
constexpr unsigned int generation_thread_limit = 4;
constexpr unsigned int prefill_thread_limit = 8;
constexpr std::size_t token_piece_buffer_bytes = 256;
constexpr std::size_t description_buffer_bytes = 256;
constexpr std::size_t utf8_sequence_limit = 4;
constexpr const char* grammar_root_rule = "root";
constexpr std::int32_t decode_success_status = 0;
constexpr std::int32_t decode_aborted_status = 2;

std::once_flag backend_initialization;

std::size_t utf8_sequence_length(unsigned char lead)
{
    if ((lead & 0xE0U) == 0xC0U) {
        return 2;
    }
    if ((lead & 0xF0U) == 0xE0U) {
        return 3;
    }
    if ((lead & 0xF8U) == 0xF0U) {
        return 4;
    }
    return 1;
}

std::size_t complete_utf8_length(std::string_view text)
{
    const std::size_t size = text.size();
    const std::size_t window = std::min(size, utf8_sequence_limit);
    for (std::size_t back = 1; back <= window; back += 1) {
        const auto byte = static_cast<unsigned char>(text[size - back]);
        if ((byte & 0xC0U) == 0x80U) {
            continue;
        }
        return back < utf8_sequence_length(byte) ? size - back : size;
    }
    return size;
}

std::int32_t checked_token_count(std::size_t count)
{
    if (count > static_cast<std::size_t>(std::numeric_limits<std::int32_t>::max())) {
        throw std::length_error("token count exceeds the llama.cpp limit");
    }
    return static_cast<std::int32_t>(count);
}

}

LlamaEngine::LlamaEngine()
    : cancel_requested_(false)
    , context_window_(0)
    , batch_tokens_(0)
{
}

LlamaEngine::~LlamaEngine() = default;

void LlamaEngine::ModelDeleter::operator()(llama_model* model) const noexcept
{
    llama_model_free(model);
}

void LlamaEngine::ContextDeleter::operator()(llama_context* context) const noexcept
{
    llama_free(context);
}

void LlamaEngine::SamplerDeleter::operator()(llama_sampler* sampler) const noexcept
{
    llama_sampler_free(sampler);
}

bool LlamaEngine::abort_requested(void* engine)
{
    return static_cast<LlamaEngine*>(engine)->cancel_requested_.load(std::memory_order_relaxed);
}

ModelState LlamaEngine::load(const std::string& file_path, std::int32_t requested_context)
{
    const std::lock_guard<std::mutex> lock(mutex_);
    std::call_once(backend_initialization, [] { llama_backend_init(); });
    templates_.reset();
    context_.reset();
    model_.reset();
    file_path_.clear();
    context_window_ = 0;
    batch_tokens_ = 0;
    cached_tokens_.clear();
    llama_model_params model_parameters = llama_model_default_params();
    model_parameters.n_gpu_layers = 0;
    std::unique_ptr<llama_model, ModelDeleter> model(llama_model_load_from_file(file_path.c_str(), model_parameters));
    if (model == nullptr) {
        throw std::runtime_error(std::format("GGUF model could not be loaded: {}", file_path));
    }
    if (llama_model_chat_template(model.get(), nullptr) == nullptr) {
        throw std::runtime_error(std::format("GGUF model has no chat template: {}", file_path));
    }
    common_chat_templates_ptr templates = common_chat_templates_init(model.get(), std::string());
    if (templates == nullptr) {
        throw std::runtime_error(std::format("GGUF chat template could not be prepared: {}", file_path));
    }
    const std::int32_t trained_context = llama_model_n_ctx_train(model.get());
    const std::int32_t ceiling = trained_context > 0 ? trained_context : requested_context;
    if (ceiling <= 0) {
        throw std::invalid_argument(std::format("context window must be positive: {}", requested_context));
    }
    const std::int32_t window = std::clamp(requested_context, std::min(minimum_context_tokens, ceiling), ceiling);
    const unsigned int hardware = std::max(1U, std::thread::hardware_concurrency());
    llama_context_params context_parameters = llama_context_default_params();
    context_parameters.n_ctx = static_cast<std::uint32_t>(window);
    context_parameters.n_batch = static_cast<std::uint32_t>(std::min(window, maximum_batch_tokens));
    context_parameters.n_ubatch = context_parameters.n_batch;
    context_parameters.n_seq_max = 1;
    context_parameters.n_threads = static_cast<std::int32_t>(std::min(hardware, generation_thread_limit));
    context_parameters.n_threads_batch = static_cast<std::int32_t>(std::min(hardware, prefill_thread_limit));
    context_parameters.abort_callback = &LlamaEngine::abort_requested;
    context_parameters.abort_callback_data = this;
    context_parameters.no_perf = true;
    std::unique_ptr<llama_context, ContextDeleter> context(llama_init_from_model(model.get(), context_parameters));
    if (context == nullptr) {
        throw std::runtime_error(std::format("GGUF context of {} tokens could not be created: {}", window, file_path));
    }
    model_ = std::move(model);
    context_ = std::move(context);
    templates_ = std::move(templates);
    file_path_ = file_path;
    context_window_ = static_cast<std::int32_t>(llama_n_ctx(context_.get()));
    batch_tokens_ = static_cast<std::int32_t>(context_parameters.n_batch);
    return describe();
}

void LlamaEngine::unload()
{
    const std::lock_guard<std::mutex> lock(mutex_);
    templates_.reset();
    context_.reset();
    model_.reset();
    file_path_.clear();
    context_window_ = 0;
    batch_tokens_ = 0;
    cached_tokens_.clear();
}

ModelState LlamaEngine::state()
{
    const std::lock_guard<std::mutex> lock(mutex_);
    return describe();
}

std::int32_t LlamaEngine::measure(const std::vector<ChatMessage>& messages, bool add_assistant)
{
    const std::lock_guard<std::mutex> lock(mutex_);
    require_loaded();
    return checked_token_count(tokenize(render(messages, add_assistant)).size());
}

PrefillResult LlamaEngine::prefill(const std::vector<ChatMessage>& messages)
{
    const std::lock_guard<std::mutex> lock(mutex_);
    require_loaded();
    const std::vector<llama_token> tokens = tokenize(render(messages, false));
    if (checked_token_count(tokens.size()) >= context_window_) {
        throw std::length_error(std::format("prefill of {} tokens exceeds the context window of {}", tokens.size(), context_window_));
    }
    return synchronize(tokens);
}

GenerationResult LlamaEngine::generate(const GenerationRequest& request, const TextSink& sink)
{
    const std::lock_guard<std::mutex> lock(mutex_);
    require_loaded();
    if (request.max_output_tokens <= 0) {
        throw std::invalid_argument(std::format("output token limit must be positive: {}", request.max_output_tokens));
    }
    const std::vector<llama_token> tokens = tokenize(render(request.messages, true));
    const std::int32_t prompt_tokens = checked_token_count(tokens.size());
    if (prompt_tokens + request.max_output_tokens > context_window_) {
        throw std::length_error(std::format(
            "prompt of {} tokens plus {} output tokens exceeds the context window of {}",
            prompt_tokens,
            request.max_output_tokens,
            context_window_));
    }
    SamplerHandle chain = create_chain(request.sampling);
    SamplerHandle grammar = create_grammar(request.grammar);
    const PrefillResult prefilled = synchronize(tokens);
    GenerationResult result{{}, prefilled.cancelled, prefilled.prompt_tokens, prefilled.reused_prefix_tokens, 0, prefilled.cached_tokens, prefilled.cache_reset};
    if (prefilled.cancelled) {
        return result;
    }
    const llama_vocab* vocab = llama_model_get_vocab(model_.get());
    std::vector<llama_token_data> candidates(static_cast<std::size_t>(llama_vocab_n_tokens(vocab)));
    std::string pending;
    for (std::int32_t index = 0; index < request.max_output_tokens; index += 1) {
        if (cancel_requested_.load(std::memory_order_relaxed)) {
            result.cancelled = true;
            break;
        }
        llama_token token = sample(chain.get(), grammar.get(), candidates);
        if (llama_vocab_is_eog(vocab, token)) {
            break;
        }
        pending += piece(token);
        const std::size_t complete = complete_utf8_length(pending);
        if (complete > 0) {
            const std::string_view chunk(pending.data(), complete);
            result.text.append(chunk);
            sink(chunk);
            pending.erase(0, complete);
        }
        result.generated_tokens += 1;
        std::vector<llama_token> single{token};
        if (!decode_tokens(single, 0)) {
            result.cancelled = true;
            break;
        }
    }
    if (!pending.empty()) {
        result.text.append(pending);
        sink(pending);
    }
    result.cached_tokens = checked_token_count(cached_tokens_.size());
    return result;
}

void LlamaEngine::clear_cancel()
{
    cancel_requested_.store(false, std::memory_order_relaxed);
}

void LlamaEngine::cancel()
{
    cancel_requested_.store(true, std::memory_order_relaxed);
}

void LlamaEngine::require_loaded() const
{
    if (model_ == nullptr || context_ == nullptr) {
        throw std::logic_error("no GGUF model is loaded");
    }
}

ModelState LlamaEngine::describe() const
{
    if (model_ == nullptr || context_ == nullptr) {
        return ModelState{false, {}, 0, 0, {}};
    }
    std::array<char, description_buffer_bytes> description{};
    const std::int32_t written = llama_model_desc(model_.get(), description.data(), description.size());
    const std::size_t length = written <= 0 ? 0 : std::min(static_cast<std::size_t>(written), description.size() - 1);
    return ModelState{
        true,
        file_path_,
        context_window_,
        llama_model_n_ctx_train(model_.get()),
        std::string(description.data(), length),
    };
}

std::string LlamaEngine::render(const std::vector<ChatMessage>& messages, bool add_assistant) const
{
    if (messages.empty()) {
        throw std::invalid_argument("chat messages are missing");
    }
    common_chat_templates_inputs inputs;
    inputs.messages.reserve(messages.size());
    for (const ChatMessage& message : messages) {
        common_chat_msg chat_message;
        chat_message.role = message.role;
        chat_message.content = message.content;
        inputs.messages.push_back(std::move(chat_message));
    }
    inputs.add_generation_prompt = add_assistant;
    inputs.use_jinja = true;
    inputs.enable_thinking = false;
    std::string prompt = common_chat_templates_apply(templates_.get(), inputs).prompt;
    if (prompt.empty()) {
        throw std::runtime_error("the GGUF chat template rendered an empty prompt");
    }
    return prompt;
}

std::vector<llama_token> LlamaEngine::tokenize(std::string_view text) const
{
    if (text.size() > static_cast<std::size_t>(std::numeric_limits<std::int32_t>::max())) {
        throw std::length_error("prompt exceeds the tokenizer input limit");
    }
    const llama_vocab* vocab = llama_model_get_vocab(model_.get());
    const auto length = static_cast<std::int32_t>(text.size());
    const std::int32_t needed = llama_tokenize(vocab, text.data(), length, nullptr, 0, true, true);
    if (needed == std::numeric_limits<std::int32_t>::min()) {
        throw std::length_error("prompt tokenization overflowed");
    }
    std::vector<llama_token> tokens(static_cast<std::size_t>(needed < 0 ? -needed : needed));
    const std::int32_t count = llama_tokenize(vocab, text.data(), length, tokens.data(), checked_token_count(tokens.size()), true, true);
    if (count < 0) {
        throw std::runtime_error("prompt tokenization failed");
    }
    tokens.resize(static_cast<std::size_t>(count));
    if (tokens.empty()) {
        throw std::runtime_error("prompt produced no tokens");
    }
    return tokens;
}

std::string LlamaEngine::piece(llama_token token) const
{
    const llama_vocab* vocab = llama_model_get_vocab(model_.get());
    std::array<char, token_piece_buffer_bytes> buffer{};
    const std::int32_t size = llama_token_to_piece(vocab, token, buffer.data(), static_cast<std::int32_t>(buffer.size()), 0, false);
    if (size >= 0) {
        return std::string(buffer.data(), static_cast<std::size_t>(size));
    }
    std::string output(static_cast<std::size_t>(-size), '\0');
    const std::int32_t written = llama_token_to_piece(vocab, token, output.data(), checked_token_count(output.size()), 0, false);
    if (written < 0) {
        throw std::runtime_error(std::format("token {} could not be converted to text", token));
    }
    output.resize(static_cast<std::size_t>(written));
    return output;
}

PrefillResult LlamaEngine::synchronize(const std::vector<llama_token>& tokens)
{
    const bool had_cache = !cached_tokens_.empty();
    std::size_t common = 0;
    const std::size_t limit = std::min(cached_tokens_.size(), tokens.size());
    while (common < limit && cached_tokens_[common] == tokens[common]) {
        common += 1;
    }
    if (common == tokens.size()) {
        common -= 1;
    }
    llama_memory_t memory = llama_get_memory(context_.get());
    bool cache_reset = had_cache && common == 0;
    if (!llama_memory_seq_rm(memory, 0, static_cast<llama_pos>(common), -1)) {
        llama_memory_clear(memory, true);
        common = 0;
        cache_reset = had_cache;
    }
    cached_tokens_.resize(common);
    std::vector<llama_token> pending(tokens);
    const bool completed = decode_tokens(pending, common);
    return PrefillResult{
        !completed,
        checked_token_count(tokens.size()),
        checked_token_count(common),
        checked_token_count(cached_tokens_.size()),
        cache_reset,
    };
}

bool LlamaEngine::decode_tokens(std::vector<llama_token>& tokens, std::size_t begin)
{
    for (std::size_t offset = begin; offset < tokens.size();) {
        if (cancel_requested_.load(std::memory_order_relaxed)) {
            return false;
        }
        const std::size_t count = std::min(tokens.size() - offset, static_cast<std::size_t>(batch_tokens_));
        const std::int32_t status = llama_decode(context_.get(), llama_batch_get_one(tokens.data() + offset, checked_token_count(count)));
        if (status == decode_aborted_status) {
            forget_cache();
            return false;
        }
        if (status != decode_success_status) {
            forget_cache();
            throw std::runtime_error(std::format("llama_decode failed with status {} at token {} of {}", status, offset, tokens.size()));
        }
        cached_tokens_.insert(cached_tokens_.end(), tokens.begin() + static_cast<std::ptrdiff_t>(offset), tokens.begin() + static_cast<std::ptrdiff_t>(offset + count));
        offset += count;
    }
    return true;
}

LlamaEngine::SamplerHandle LlamaEngine::create_chain(const SamplingParameters& sampling) const
{
    llama_sampler_chain_params parameters = llama_sampler_chain_default_params();
    parameters.no_perf = true;
    SamplerHandle chain(llama_sampler_chain_init(parameters));
    if (chain == nullptr) {
        throw std::runtime_error("sampler chain could not be created");
    }
    llama_sampler_chain_add(chain.get(), llama_sampler_init_top_k(sampling.top_k));
    llama_sampler_chain_add(chain.get(), llama_sampler_init_top_p(sampling.top_p, 1));
    llama_sampler_chain_add(chain.get(), llama_sampler_init_temp(sampling.temperature));
    llama_sampler_chain_add(chain.get(), llama_sampler_init_dist(sampling.seed));
    return chain;
}

LlamaEngine::SamplerHandle LlamaEngine::create_grammar(const std::string& grammar) const
{
    if (grammar.empty()) {
        return SamplerHandle(nullptr);
    }
    SamplerHandle sampler(llama_sampler_init_grammar(llama_model_get_vocab(model_.get()), grammar.c_str(), grammar_root_rule));
    if (sampler == nullptr) {
        throw std::invalid_argument("the response grammar could not be parsed");
    }
    return sampler;
}

llama_token LlamaEngine::sample(llama_sampler* chain, llama_sampler* grammar, std::vector<llama_token_data>& candidates)
{
    const float* logits = llama_get_logits_ith(context_.get(), -1);
    if (logits == nullptr) {
        throw std::runtime_error("llama.cpp produced no logits to sample");
    }
    const auto fill = [&]() {
        for (std::size_t index = 0; index < candidates.size(); index += 1) {
            candidates[index] = llama_token_data{static_cast<llama_token>(index), logits[index], 0.0F};
        }
        return llama_token_data_array{candidates.data(), candidates.size(), -1, false};
    };
    llama_token_data_array array = fill();
    llama_sampler_apply(chain, &array);
    llama_token token = array.data[array.selected].id;
    if (grammar != nullptr) {
        llama_token_data single{token, 1.0F, 0.0F};
        llama_token_data_array probe{&single, 1, -1, false};
        llama_sampler_apply(grammar, &probe);
        if (std::isinf(probe.data[0].logit) && probe.data[0].logit < 0.0F) {
            array = fill();
            llama_sampler_apply(grammar, &array);
            llama_sampler_apply(chain, &array);
            token = array.data[array.selected].id;
        }
        llama_sampler_accept(grammar, token);
    }
    llama_sampler_accept(chain, token);
    return token;
}

void LlamaEngine::forget_cache()
{
    llama_memory_clear(llama_get_memory(context_.get()), true);
    cached_tokens_.clear();
}

}
