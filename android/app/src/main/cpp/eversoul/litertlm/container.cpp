#include "eversoul/litertlm/container.h"

#include <algorithm>
#include <array>
#include <cctype>
#include <string_view>
#include <utility>

#include "eversoul/format/flatbuffer_table.h"

namespace eversoul::litertlm {
namespace {

constexpr std::string_view kMagic = "LITERTLM";
constexpr std::size_t kMajorVersionOffset = 8;
constexpr std::size_t kMinorVersionOffset = 12;
constexpr std::size_t kPatchVersionOffset = 16;
constexpr std::size_t kHeaderEndOffsetPosition = 24;
constexpr std::size_t kMetadataPosition = 32;
constexpr std::uint32_t kSupportedMajorVersion = 1;

constexpr std::uint16_t kMetadataSectionMetadataField = 1;
constexpr std::uint16_t kSectionMetadataObjectsField = 0;
constexpr std::uint16_t kSectionObjectItemsField = 0;
constexpr std::uint16_t kSectionObjectBeginOffsetField = 1;
constexpr std::uint16_t kSectionObjectEndOffsetField = 2;
constexpr std::uint16_t kSectionObjectDataTypeField = 3;
constexpr std::uint16_t kKeyValuePairKeyField = 0;
constexpr std::uint16_t kKeyValuePairValueTypeField = 1;
constexpr std::uint16_t kKeyValuePairValueField = 2;
constexpr std::uint16_t kStringValueField = 0;
constexpr std::uint8_t kValueTypeStringValue = 9;
constexpr std::uint8_t kMaxSectionDataType = static_cast<std::uint8_t>(SectionDataType::ExecutorMetadataProto);

constexpr std::string_view kModelTypeKey = "model_type";
constexpr std::string_view kBackendConstraintKey = "backend_constraint";

constexpr std::array<std::pair<std::string_view, TfLiteModelRole>, 15> kModelRoleNames = {{
    {"tf_lite_prefill_decode", TfLiteModelRole::PrefillDecode},
    {"tf_lite_embedder", TfLiteModelRole::Embedder},
    {"tf_lite_per_layer_embedder", TfLiteModelRole::PerLayerEmbedder},
    {"tf_lite_aux", TfLiteModelRole::Aux},
    {"tf_lite_audio_frontend", TfLiteModelRole::AudioFrontend},
    {"tf_lite_audio_encoder_hw", TfLiteModelRole::AudioEncoderHw},
    {"tf_lite_audio_adapter", TfLiteModelRole::AudioAdapter},
    {"tf_lite_end_of_audio", TfLiteModelRole::EndOfAudio},
    {"tf_lite_vision_adapter", TfLiteModelRole::VisionAdapter},
    {"tf_lite_end_of_vision", TfLiteModelRole::EndOfVision},
    {"tf_lite_vision_encoder", TfLiteModelRole::VisionEncoder},
    {"tf_lite_artisan_text_decoder", TfLiteModelRole::ArtisanTextDecoder},
    {"tf_lite_mtp_drafter", TfLiteModelRole::MtpDrafter},
    {"tf_lite_mtp_aux", TfLiteModelRole::MtpAux},
    {"tf_lite_text_encoder", TfLiteModelRole::TextEncoder},
}};

std::string toLowerAscii(std::string_view text) {
    std::string lowered(text);
    std::ranges::transform(lowered, lowered.begin(), [](unsigned char character) {
        return static_cast<char>(std::tolower(character));
    });
    return lowered;
}

core::Result<TfLiteModelRole> parseModelRole(std::string_view name) {
    const std::string lowered = toLowerAscii(name);
    const auto match = std::ranges::find(kModelRoleNames, std::string_view(lowered), &std::pair<std::string_view, TfLiteModelRole>::first);
    if (match == kModelRoleNames.end()) {
        return core::fail(core::FailureCode::InvalidModelFile, "unknown_model_type:" + std::string(name));
    }
    return match->second;
}

core::Result<std::optional<std::string_view>> readStringValue(const format::FlatBufferTable& pair) {
    auto valueType = pair.scalar<std::uint8_t>(kKeyValuePairValueTypeField, 0);
    if (!valueType) {
        return std::unexpected(valueType.error());
    }
    if (*valueType != kValueTypeStringValue) {
        return std::optional<std::string_view>{};
    }
    auto value = pair.table(kKeyValuePairValueField);
    if (!value) {
        return std::unexpected(value.error());
    }
    if (!value->has_value()) {
        return std::optional<std::string_view>{};
    }
    return (*value)->string(kStringValueField);
}

core::Result<void> applySectionItems(const format::FlatBufferTable& section, SectionEntry& entry) {
    auto items = section.tableVector(kSectionObjectItemsField);
    if (!items) {
        return std::unexpected(items.error());
    }
    if (!items->has_value()) {
        return {};
    }
    for (std::uint32_t index = 0; index < (*items)->size(); ++index) {
        auto pair = (*items)->at(index);
        if (!pair) {
            return std::unexpected(pair.error());
        }
        auto key = pair->string(kKeyValuePairKeyField);
        if (!key) {
            return std::unexpected(key.error());
        }
        if (!key->has_value()) {
            continue;
        }
        const std::string loweredKey = toLowerAscii(**key);
        if (loweredKey != kModelTypeKey && loweredKey != kBackendConstraintKey) {
            continue;
        }
        auto value = readStringValue(*pair);
        if (!value) {
            return std::unexpected(value.error());
        }
        if (!value->has_value()) {
            return core::fail(core::FailureCode::InvalidModelFile, "section_item_not_string:" + loweredKey);
        }
        if (loweredKey == kModelTypeKey) {
            auto role = parseModelRole(**value);
            if (!role) {
                return std::unexpected(role.error());
            }
            entry.modelRole = *role;
        }
        else {
            entry.backendConstraint = std::string(**value);
        }
    }
    return {};
}

core::Result<SectionEntry> readSection(const format::FlatBufferTable& section, std::uint64_t fileSize) {
    auto dataType = section.scalar<std::uint8_t>(kSectionObjectDataTypeField, 0);
    auto beginOffset = section.scalar<std::uint64_t>(kSectionObjectBeginOffsetField, 0);
    auto endOffset = section.scalar<std::uint64_t>(kSectionObjectEndOffsetField, 0);
    if (!dataType) {
        return std::unexpected(dataType.error());
    }
    if (!beginOffset) {
        return std::unexpected(beginOffset.error());
    }
    if (!endOffset) {
        return std::unexpected(endOffset.error());
    }
    if (*dataType > kMaxSectionDataType) {
        return core::fail(core::FailureCode::InvalidModelFile, "unknown_section_data_type:" + std::to_string(*dataType));
    }
    if (*beginOffset > *endOffset || *endOffset > fileSize) {
        return core::fail(core::FailureCode::InvalidModelFile, "section_offsets_invalid:" + std::to_string(*beginOffset) + "-" + std::to_string(*endOffset));
    }
    SectionEntry entry{static_cast<SectionDataType>(*dataType), std::nullopt, std::nullopt, *beginOffset, *endOffset};
    if (auto applied = applySectionItems(section, entry); !applied) {
        return std::unexpected(applied.error());
    }
    const bool modelSection = entry.dataType == SectionDataType::TfLiteModel || entry.dataType == SectionDataType::TfLiteWeights;
    if (modelSection && !entry.modelRole.has_value()) {
        entry.modelRole = TfLiteModelRole::PrefillDecode;
    }
    if (!modelSection) {
        entry.modelRole.reset();
    }
    return entry;
}

}

core::Result<ContainerIndex> readContainerIndex(format::ByteSpan file) {
    if (file.size() < kMetadataPosition) {
        return core::fail(core::FailureCode::InvalidModelFile, "file_too_small");
    }
    const std::string_view magic(reinterpret_cast<const char*>(file.data()), kMagic.size());
    if (magic != kMagic) {
        return core::fail(core::FailureCode::InvalidModelFile, "magic_mismatch");
    }
    auto major = format::readLittleEndian<std::uint32_t>(file, kMajorVersionOffset);
    auto minor = format::readLittleEndian<std::uint32_t>(file, kMinorVersionOffset);
    auto patch = format::readLittleEndian<std::uint32_t>(file, kPatchVersionOffset);
    auto headerEnd = format::readLittleEndian<std::uint64_t>(file, kHeaderEndOffsetPosition);
    if (!major || !minor || !patch || !headerEnd) {
        return core::fail(core::FailureCode::InvalidModelFile, "header_truncated");
    }
    if (*major != kSupportedMajorVersion) {
        return core::fail(core::FailureCode::InvalidModelFile, "unsupported_major_version:" + std::to_string(*major));
    }
    if (*headerEnd <= kMetadataPosition || *headerEnd > file.size()) {
        return core::fail(core::FailureCode::InvalidModelFile, "header_end_invalid:" + std::to_string(*headerEnd));
    }
    auto metadataBytes = format::sliceBytes(file, kMetadataPosition, static_cast<std::size_t>(*headerEnd) - kMetadataPosition);
    if (!metadataBytes) {
        return std::unexpected(metadataBytes.error());
    }
    auto metadata = format::FlatBufferTable::root(*metadataBytes);
    if (!metadata) {
        return std::unexpected(metadata.error());
    }
    auto sectionMetadata = metadata->table(kMetadataSectionMetadataField);
    if (!sectionMetadata) {
        return std::unexpected(sectionMetadata.error());
    }
    if (!sectionMetadata->has_value()) {
        return core::fail(core::FailureCode::InvalidModelFile, "section_metadata_missing");
    }
    auto objects = (*sectionMetadata)->tableVector(kSectionMetadataObjectsField);
    if (!objects) {
        return std::unexpected(objects.error());
    }
    if (!objects->has_value()) {
        return core::fail(core::FailureCode::InvalidModelFile, "section_objects_missing");
    }
    ContainerIndex index{{*major, *minor, *patch}, {}};
    index.sections.reserve((*objects)->size());
    for (std::uint32_t position = 0; position < (*objects)->size(); ++position) {
        auto object = (*objects)->at(position);
        if (!object) {
            return std::unexpected(object.error());
        }
        auto section = readSection(*object, file.size());
        if (!section) {
            return std::unexpected(section.error());
        }
        index.sections.push_back(std::move(*section));
    }
    return index;
}

const SectionEntry* findSection(const ContainerIndex& index, SectionDataType dataType, std::optional<TfLiteModelRole> modelRole) noexcept {
    const auto match = std::ranges::find_if(index.sections, [&](const SectionEntry& section) {
        return section.dataType == dataType && (!modelRole.has_value() || section.modelRole == modelRole);
    });
    return match == index.sections.end() ? nullptr : &*match;
}

core::Result<format::ByteSpan> sectionBytes(format::ByteSpan file, const SectionEntry& section) {
    return format::sliceBytes(file, static_cast<std::size_t>(section.beginOffset), static_cast<std::size_t>(section.endOffset - section.beginOffset));
}

}
