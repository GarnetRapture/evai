#pragma once

#include <atomic>
#include <memory>
#include <string>

#include "eversoul/core/failure.h"
#include "eversoul/inference/chat_prompt.h"
#include "eversoul/inference/compiled_graph_factory.h"
#include "eversoul/inference/generation_session.h"
#include "eversoul/inference/tensor.h"
#include "eversoul/litertlm/container.h"
#include "eversoul/litertlm/llm_metadata.h"
#include "eversoul/litertlm/mapped_model_file.h"
#include "eversoul/tokenizer/tokenizer.h"
#include "eversoul/unicode/code_point_category.h"

namespace eversoul::inference {

struct EngineStatus {
    std::string loadedModelPath;
    ComputeBackend backend;
    std::int32_t contextWindow;
};

class LiteRtLmEngine {
public:
    [[nodiscard]] static core::Result<std::unique_ptr<LiteRtLmEngine>> load(
        const std::string& modelPath,
        const CompiledGraphOptions& options,
        std::shared_ptr<const unicode::CodePointClassifier> classifier);

    [[nodiscard]] core::Result<GenerationOutcome> generate(
        const ChatPrompt& prompt,
        std::int32_t maxOutputTokens,
        const ChunkCallback& onChunk,
        const std::atomic<bool>& cancelled);

    [[nodiscard]] EngineStatus status() const;
    [[nodiscard]] std::int32_t contextWindow() const noexcept { return contextWindow_; }

private:
    LiteRtLmEngine(
        litertlm::MappedModelFile modelFile,
        litertlm::ContainerIndex index,
        litertlm::LlmMetadata metadata,
        std::unique_ptr<tokenizer::Tokenizer> tokenizer,
        std::unique_ptr<CompiledGraph> graph,
        ComputeBackend backend,
        std::int32_t contextWindow,
        std::string modelPath);

    litertlm::MappedModelFile modelFile_;
    litertlm::ContainerIndex index_;
    litertlm::LlmMetadata metadata_;
    std::unique_ptr<tokenizer::Tokenizer> tokenizer_;
    std::unique_ptr<CompiledGraph> graph_;
    ComputeBackend backend_;
    std::int32_t contextWindow_;
    std::string modelPath_;
};

}
