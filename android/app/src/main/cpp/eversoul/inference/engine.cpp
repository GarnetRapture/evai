#include "eversoul/inference/engine.h"

#include <algorithm>
#include <utility>

#include "eversoul/tokenizer/tokenizer_factory.h"

namespace eversoul::inference {
namespace {

constexpr std::int32_t kDefaultContextWindow = 4096;

std::int32_t resolveContextWindow(const litertlm::LlmMetadata& metadata, std::int32_t requested) {
    std::int32_t window = requested > 0 ? requested : kDefaultContextWindow;
    if (metadata.maxNumTokens > 0) {
        window = std::min(window, metadata.maxNumTokens);
    }
    return window;
}

}

core::Result<std::unique_ptr<LiteRtLmEngine>> LiteRtLmEngine::load(
    const std::string& modelPath,
    const CompiledGraphOptions& options,
    std::shared_ptr<const unicode::CodePointClassifier> classifier) {
    auto modelFile = litertlm::MappedModelFile::open(modelPath);
    if (!modelFile) {
        return std::unexpected(modelFile.error());
    }
    auto index = litertlm::readContainerIndex(modelFile->bytes());
    if (!index) {
        return std::unexpected(index.error());
    }
    const litertlm::SectionEntry* metadataSection = litertlm::findSection(*index, litertlm::SectionDataType::LlmMetadataProto);
    if (metadataSection == nullptr) {
        return core::fail(core::FailureCode::InvalidModelFile, "missing_llm_metadata");
    }
    auto metadataBytes = litertlm::sectionBytes(modelFile->bytes(), *metadataSection);
    if (!metadataBytes) {
        return std::unexpected(metadataBytes.error());
    }
    auto metadata = litertlm::decodeLlmMetadata(*metadataBytes);
    if (!metadata) {
        return std::unexpected(metadata.error());
    }
    auto tokenizer = tokenizer::buildTokenizer(modelFile->bytes(), *index, std::move(classifier));
    if (!tokenizer) {
        return std::unexpected(tokenizer.error());
    }
    const litertlm::SectionEntry* modelSection = litertlm::findSection(*index, litertlm::SectionDataType::TfLiteModel, litertlm::TfLiteModelRole::PrefillDecode);
    if (modelSection == nullptr) {
        return core::fail(core::FailureCode::InvalidModelFile, "missing_prefill_decode_model");
    }
    auto modelBytes = litertlm::sectionBytes(modelFile->bytes(), *modelSection);
    if (!modelBytes) {
        return std::unexpected(modelBytes.error());
    }
    const std::int32_t contextWindow = resolveContextWindow(*metadata, options.maxContextTokens);
    CompiledGraphOptions graphOptions = options;
    graphOptions.maxContextTokens = contextWindow;
    auto graph = createLiteRtCompiledGraph(*modelBytes, graphOptions);
    if (!graph) {
        return std::unexpected(graph.error());
    }
    return std::unique_ptr<LiteRtLmEngine>(new LiteRtLmEngine(
        std::move(*modelFile), std::move(*index), std::move(*metadata), std::move(*tokenizer), std::move(*graph),
        options.backend, contextWindow, modelPath));
}

LiteRtLmEngine::LiteRtLmEngine(
    litertlm::MappedModelFile modelFile,
    litertlm::ContainerIndex index,
    litertlm::LlmMetadata metadata,
    std::unique_ptr<tokenizer::Tokenizer> tokenizer,
    std::unique_ptr<CompiledGraph> graph,
    ComputeBackend backend,
    std::int32_t contextWindow,
    std::string modelPath)
    : modelFile_(std::move(modelFile)),
      index_(std::move(index)),
      metadata_(std::move(metadata)),
      tokenizer_(std::move(tokenizer)),
      graph_(std::move(graph)),
      backend_(backend),
      contextWindow_(contextWindow),
      modelPath_(std::move(modelPath)) {}

core::Result<GenerationOutcome> LiteRtLmEngine::generate(
    const ChatPrompt& prompt,
    std::int32_t maxOutputTokens,
    const ChunkCallback& onChunk,
    const std::atomic<bool>& cancelled) {
    const GenerationLimits limits{contextWindow_, std::max(1, maxOutputTokens), metadata_.kvCacheInitValue.has_value() ? 0 : 0};
    GenerationSession session(*graph_, *tokenizer_, metadata_, limits);
    return session.generate(prompt, onChunk, cancelled);
}

EngineStatus LiteRtLmEngine::status() const {
    return EngineStatus{modelPath_, backend_, contextWindow_};
}

}
