#include "eversoul/tokenizer/tokenizer_factory.h"

#include <utility>

#include "eversoul/litertlm/zlib_inflate.h"
#include "eversoul/tokenizer/huggingface_tokenizer.h"
#include "eversoul/tokenizer/sentencepiece_tokenizer.h"

namespace eversoul::tokenizer {

core::Result<std::unique_ptr<Tokenizer>> buildTokenizer(
    format::ByteSpan modelFile,
    const litertlm::ContainerIndex& index,
    std::shared_ptr<const unicode::CodePointClassifier> classifier) {
    if (const litertlm::SectionEntry* hfSection = litertlm::findSection(index, litertlm::SectionDataType::HuggingFaceTokenizerZlib)) {
        auto compressed = litertlm::sectionBytes(modelFile, *hfSection);
        if (!compressed) {
            return std::unexpected(compressed.error());
        }
        auto tokenizerJson = litertlm::inflateHuggingFaceTokenizer(*compressed);
        if (!tokenizerJson) {
            return std::unexpected(tokenizerJson.error());
        }
        auto tokenizer = HuggingFaceTokenizer::create(*tokenizerJson, std::move(classifier));
        if (!tokenizer) {
            return std::unexpected(tokenizer.error());
        }
        return std::unique_ptr<Tokenizer>(std::move(*tokenizer));
    }
    if (const litertlm::SectionEntry* spSection = litertlm::findSection(index, litertlm::SectionDataType::SentencePieceTokenizer)) {
        auto modelBytes = litertlm::sectionBytes(modelFile, *spSection);
        if (!modelBytes) {
            return std::unexpected(modelBytes.error());
        }
        auto tokenizer = SentencePieceTokenizer::create(*modelBytes);
        if (!tokenizer) {
            return std::unexpected(tokenizer.error());
        }
        return std::unique_ptr<Tokenizer>(std::move(*tokenizer));
    }
    return core::fail(core::FailureCode::InvalidModelFile, "no_tokenizer_section");
}

}
