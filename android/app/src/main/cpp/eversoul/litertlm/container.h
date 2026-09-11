#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include "eversoul/core/failure.h"
#include "eversoul/format/byte_reader.h"

namespace eversoul::litertlm {

enum class SectionDataType : std::uint8_t {
    None = 0,
    GenericBinaryData = 1,
    Deprecated = 2,
    TfLiteModel = 3,
    SentencePieceTokenizer = 4,
    LlmMetadataProto = 5,
    HuggingFaceTokenizerZlib = 6,
    TfLiteWeights = 7,
    EmbeddingMetadataProto = 8,
    ExecutorMetadataProto = 9,
};

enum class TfLiteModelRole {
    PrefillDecode,
    Embedder,
    PerLayerEmbedder,
    Aux,
    AudioFrontend,
    AudioEncoderHw,
    AudioAdapter,
    EndOfAudio,
    VisionAdapter,
    EndOfVision,
    VisionEncoder,
    ArtisanTextDecoder,
    MtpDrafter,
    MtpAux,
    TextEncoder,
};

struct ContainerVersion {
    std::uint32_t major;
    std::uint32_t minor;
    std::uint32_t patch;
};

struct SectionEntry {
    SectionDataType dataType;
    std::optional<TfLiteModelRole> modelRole;
    std::optional<std::string> backendConstraint;
    std::uint64_t beginOffset;
    std::uint64_t endOffset;
};

struct ContainerIndex {
    ContainerVersion version;
    std::vector<SectionEntry> sections;
};

[[nodiscard]] core::Result<ContainerIndex> readContainerIndex(format::ByteSpan file);

[[nodiscard]] const SectionEntry* findSection(const ContainerIndex& index, SectionDataType dataType, std::optional<TfLiteModelRole> modelRole = std::nullopt) noexcept;

[[nodiscard]] core::Result<format::ByteSpan> sectionBytes(format::ByteSpan file, const SectionEntry& section);

}
