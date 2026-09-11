#include "eversoul/litertlm/llm_metadata.h"

#include <utility>

#include "eversoul/format/protobuf_reader.h"

namespace eversoul::litertlm {
namespace {

using format::ProtobufField;
using format::ProtobufReader;
using format::ProtobufWireType;

namespace token_union_field {
constexpr std::uint32_t kTokenIds = 1;
constexpr std::uint32_t kTokenString = 2;
}

namespace token_ids_field {
constexpr std::uint32_t kIds = 1;
}

namespace prompt_affixes_field {
constexpr std::uint32_t kPrefix = 1;
constexpr std::uint32_t kSuffix = 2;
}

namespace prompt_templates_field {
constexpr std::uint32_t kUser = 1;
constexpr std::uint32_t kModel = 2;
constexpr std::uint32_t kSystem = 3;
}

namespace sampler_field {
constexpr std::uint32_t kType = 1;
constexpr std::uint32_t kK = 2;
constexpr std::uint32_t kP = 3;
constexpr std::uint32_t kTemperature = 4;
constexpr std::uint32_t kSeed = 5;
}

namespace channel_field {
constexpr std::uint32_t kName = 1;
constexpr std::uint32_t kStart = 2;
constexpr std::uint32_t kEnd = 3;
constexpr std::uint32_t kReasoning = 4;
}

namespace generic_model_field {
constexpr std::uint32_t kModelRole = 1;
constexpr std::uint32_t kForceStringContent = 2;
}

namespace model_type_field {
constexpr std::uint32_t kGeneric = 1;
constexpr std::uint32_t kGemma3n = 2;
constexpr std::uint32_t kFunctionGemma = 3;
constexpr std::uint32_t kGemma3 = 4;
constexpr std::uint32_t kQwen3 = 5;
constexpr std::uint32_t kQwen2p5 = 7;
constexpr std::uint32_t kGemma4 = 8;
constexpr std::uint32_t kFastVlm = 9;
constexpr std::uint32_t kLfm2 = 11;
constexpr std::uint32_t kMiniCpm5 = 12;
}

namespace metadata_field {
constexpr std::uint32_t kStartToken = 1;
constexpr std::uint32_t kStopTokens = 2;
constexpr std::uint32_t kPromptTemplates = 3;
constexpr std::uint32_t kSamplerParameters = 4;
constexpr std::uint32_t kMaxNumTokens = 5;
constexpr std::uint32_t kModelType = 6;
constexpr std::uint32_t kJinjaPromptTemplate = 7;
constexpr std::uint32_t kChannels = 8;
constexpr std::uint32_t kSuppressTokens = 9;
constexpr std::uint32_t kKvCacheInitValue = 10;
constexpr std::uint32_t kSupportsThinking = 11;
constexpr std::uint32_t kSupportsFunctionCalling = 12;
constexpr std::uint32_t kPadToken = 13;
constexpr std::uint32_t kMinRuntimeVersion = 14;
}

template <typename Handler>
core::Result<void> forEachField(format::ByteSpan message, Handler&& handler) {
    ProtobufReader reader(message);
    while (true) {
        auto field = reader.next();
        if (!field) {
            return std::unexpected(field.error());
        }
        if (!field->has_value()) {
            return {};
        }
        if (auto handled = handler(**field); !handled) {
            return std::unexpected(handled.error());
        }
    }
}

core::Result<std::string> stringField(const ProtobufField& field) {
    if (auto checked = format::expectWireType(field, ProtobufWireType::LengthDelimited, "metadata_string_wire_type"); !checked) {
        return std::unexpected(checked.error());
    }
    return format::protobufString(field);
}

core::Result<ProtobufField> varintField(const ProtobufField& field) {
    if (auto checked = format::expectWireType(field, ProtobufWireType::Varint, "metadata_varint_wire_type"); !checked) {
        return std::unexpected(checked.error());
    }
    return field;
}

core::Result<ProtobufField> messageField(const ProtobufField& field) {
    if (auto checked = format::expectWireType(field, ProtobufWireType::LengthDelimited, "metadata_message_wire_type"); !checked) {
        return std::unexpected(checked.error());
    }
    return field;
}

core::Result<TokenIdSequence> decodeTokenIds(format::ByteSpan message) {
    TokenIdSequence ids;
    auto decoded = forEachField(message, [&](const ProtobufField& field) -> core::Result<void> {
        if (field.number == token_ids_field::kIds) {
            return format::appendProtobufInt32Values(field, ids);
        }
        return {};
    });
    if (!decoded) {
        return std::unexpected(decoded.error());
    }
    return ids;
}

core::Result<TokenUnion> decodeTokenUnion(format::ByteSpan message) {
    std::optional<TokenUnion> token;
    auto decoded = forEachField(message, [&](const ProtobufField& field) -> core::Result<void> {
        if (field.number == token_union_field::kTokenIds) {
            auto nested = messageField(field);
            if (!nested) {
                return std::unexpected(nested.error());
            }
            auto ids = decodeTokenIds(nested->payload);
            if (!ids) {
                return std::unexpected(ids.error());
            }
            token = TokenUnion{std::move(*ids)};
        }
        else if (field.number == token_union_field::kTokenString) {
            auto text = stringField(field);
            if (!text) {
                return std::unexpected(text.error());
            }
            token = TokenUnion{std::move(*text)};
        }
        return {};
    });
    if (!decoded) {
        return std::unexpected(decoded.error());
    }
    if (!token.has_value()) {
        return TokenUnion{TokenIdSequence{}};
    }
    return std::move(*token);
}

core::Result<PromptAffixes> decodePromptAffixes(format::ByteSpan message) {
    PromptAffixes affixes;
    auto decoded = forEachField(message, [&](const ProtobufField& field) -> core::Result<void> {
        if (field.number != prompt_affixes_field::kPrefix && field.number != prompt_affixes_field::kSuffix) {
            return {};
        }
        auto text = stringField(field);
        if (!text) {
            return std::unexpected(text.error());
        }
        (field.number == prompt_affixes_field::kPrefix ? affixes.prefix : affixes.suffix) = std::move(*text);
        return {};
    });
    if (!decoded) {
        return std::unexpected(decoded.error());
    }
    return affixes;
}

core::Result<PromptTemplates> decodePromptTemplates(format::ByteSpan message) {
    PromptTemplates templates;
    auto decoded = forEachField(message, [&](const ProtobufField& field) -> core::Result<void> {
        std::optional<PromptAffixes>* target = nullptr;
        switch (field.number) {
            case prompt_templates_field::kUser:
                target = &templates.user;
                break;
            case prompt_templates_field::kModel:
                target = &templates.model;
                break;
            case prompt_templates_field::kSystem:
                target = &templates.system;
                break;
            default:
                return {};
        }
        auto nested = messageField(field);
        if (!nested) {
            return std::unexpected(nested.error());
        }
        auto affixes = decodePromptAffixes(nested->payload);
        if (!affixes) {
            return std::unexpected(affixes.error());
        }
        *target = std::move(*affixes);
        return {};
    });
    if (!decoded) {
        return std::unexpected(decoded.error());
    }
    return templates;
}

core::Result<SamplerParameters> decodeSamplerParameters(format::ByteSpan message) {
    SamplerParameters parameters;
    auto decoded = forEachField(message, [&](const ProtobufField& field) -> core::Result<void> {
        switch (field.number) {
            case sampler_field::kType: {
                auto value = varintField(field);
                if (!value) {
                    return std::unexpected(value.error());
                }
                parameters.type = static_cast<SamplerType>(format::protobufInt32(*value));
                return {};
            }
            case sampler_field::kK: {
                auto value = varintField(field);
                if (!value) {
                    return std::unexpected(value.error());
                }
                parameters.k = format::protobufInt32(*value);
                return {};
            }
            case sampler_field::kP: {
                auto value = format::protobufFloat32(field);
                if (!value) {
                    return std::unexpected(value.error());
                }
                parameters.p = *value;
                return {};
            }
            case sampler_field::kTemperature: {
                auto value = format::protobufFloat32(field);
                if (!value) {
                    return std::unexpected(value.error());
                }
                parameters.temperature = *value;
                return {};
            }
            case sampler_field::kSeed: {
                auto value = varintField(field);
                if (!value) {
                    return std::unexpected(value.error());
                }
                parameters.seed = format::protobufInt32(*value);
                return {};
            }
            default:
                return {};
        }
    });
    if (!decoded) {
        return std::unexpected(decoded.error());
    }
    return parameters;
}

core::Result<ResponseChannel> decodeChannel(format::ByteSpan message) {
    ResponseChannel channel;
    auto decoded = forEachField(message, [&](const ProtobufField& field) -> core::Result<void> {
        if (field.number == channel_field::kReasoning) {
            auto value = varintField(field);
            if (!value) {
                return std::unexpected(value.error());
            }
            channel.reasoning = format::protobufBool(*value);
            return {};
        }
        std::string* target = nullptr;
        switch (field.number) {
            case channel_field::kName:
                target = &channel.name;
                break;
            case channel_field::kStart:
                target = &channel.start;
                break;
            case channel_field::kEnd:
                target = &channel.end;
                break;
            default:
                return {};
        }
        auto text = stringField(field);
        if (!text) {
            return std::unexpected(text.error());
        }
        *target = std::move(*text);
        return {};
    });
    if (!decoded) {
        return std::unexpected(decoded.error());
    }
    return channel;
}

core::Result<GenericModelSettings> decodeGenericModel(format::ByteSpan message) {
    GenericModelSettings settings;
    auto decoded = forEachField(message, [&](const ProtobufField& field) -> core::Result<void> {
        if (field.number == generic_model_field::kModelRole) {
            auto text = stringField(field);
            if (!text) {
                return std::unexpected(text.error());
            }
            settings.modelRole = std::move(*text);
        }
        else if (field.number == generic_model_field::kForceStringContent) {
            auto value = varintField(field);
            if (!value) {
                return std::unexpected(value.error());
            }
            settings.forceStringContent = format::protobufBool(*value);
        }
        return {};
    });
    if (!decoded) {
        return std::unexpected(decoded.error());
    }
    return settings;
}

LlmModelFamily modelFamilyForField(std::uint32_t number) noexcept {
    switch (number) {
        case model_type_field::kGeneric:
            return LlmModelFamily::Generic;
        case model_type_field::kGemma3n:
            return LlmModelFamily::Gemma3n;
        case model_type_field::kFunctionGemma:
            return LlmModelFamily::FunctionGemma;
        case model_type_field::kGemma3:
            return LlmModelFamily::Gemma3;
        case model_type_field::kQwen3:
            return LlmModelFamily::Qwen3;
        case model_type_field::kQwen2p5:
            return LlmModelFamily::Qwen2p5;
        case model_type_field::kGemma4:
            return LlmModelFamily::Gemma4;
        case model_type_field::kFastVlm:
            return LlmModelFamily::FastVlm;
        case model_type_field::kLfm2:
            return LlmModelFamily::Lfm2;
        case model_type_field::kMiniCpm5:
            return LlmModelFamily::MiniCpm5;
        default:
            return LlmModelFamily::Unspecified;
    }
}

core::Result<void> decodeModelType(format::ByteSpan message, LlmMetadata& metadata) {
    return forEachField(message, [&](const ProtobufField& field) -> core::Result<void> {
        const LlmModelFamily family = modelFamilyForField(field.number);
        if (family == LlmModelFamily::Unspecified) {
            return {};
        }
        auto nested = messageField(field);
        if (!nested) {
            return std::unexpected(nested.error());
        }
        metadata.modelFamily = family;
        metadata.genericModel.reset();
        if (family == LlmModelFamily::Generic) {
            auto generic = decodeGenericModel(nested->payload);
            if (!generic) {
                return std::unexpected(generic.error());
            }
            metadata.genericModel = std::move(*generic);
        }
        return {};
    });
}

core::Result<void> decodeMetadataField(const ProtobufField& field, LlmMetadata& metadata) {
    switch (field.number) {
        case metadata_field::kStartToken:
        case metadata_field::kStopTokens:
        case metadata_field::kPadToken: {
            auto nested = messageField(field);
            if (!nested) {
                return std::unexpected(nested.error());
            }
            auto token = decodeTokenUnion(nested->payload);
            if (!token) {
                return std::unexpected(token.error());
            }
            if (field.number == metadata_field::kStopTokens) {
                metadata.stopTokens.push_back(std::move(*token));
            }
            else if (field.number == metadata_field::kStartToken) {
                metadata.startToken = std::move(*token);
            }
            else {
                metadata.padToken = std::move(*token);
            }
            return {};
        }
        case metadata_field::kPromptTemplates: {
            auto nested = messageField(field);
            if (!nested) {
                return std::unexpected(nested.error());
            }
            auto templates = decodePromptTemplates(nested->payload);
            if (!templates) {
                return std::unexpected(templates.error());
            }
            metadata.promptTemplates = std::move(*templates);
            return {};
        }
        case metadata_field::kSamplerParameters: {
            auto nested = messageField(field);
            if (!nested) {
                return std::unexpected(nested.error());
            }
            auto parameters = decodeSamplerParameters(nested->payload);
            if (!parameters) {
                return std::unexpected(parameters.error());
            }
            metadata.samplerParameters = *parameters;
            return {};
        }
        case metadata_field::kMaxNumTokens: {
            auto value = varintField(field);
            if (!value) {
                return std::unexpected(value.error());
            }
            metadata.maxNumTokens = format::protobufInt32(*value);
            return {};
        }
        case metadata_field::kModelType: {
            auto nested = messageField(field);
            if (!nested) {
                return std::unexpected(nested.error());
            }
            return decodeModelType(nested->payload, metadata);
        }
        case metadata_field::kJinjaPromptTemplate: {
            auto text = stringField(field);
            if (!text) {
                return std::unexpected(text.error());
            }
            metadata.jinjaPromptTemplate = std::move(*text);
            return {};
        }
        case metadata_field::kChannels: {
            auto nested = messageField(field);
            if (!nested) {
                return std::unexpected(nested.error());
            }
            auto channel = decodeChannel(nested->payload);
            if (!channel) {
                return std::unexpected(channel.error());
            }
            metadata.channels.push_back(std::move(*channel));
            return {};
        }
        case metadata_field::kSuppressTokens: {
            auto nested = messageField(field);
            if (!nested) {
                return std::unexpected(nested.error());
            }
            auto ids = decodeTokenIds(nested->payload);
            if (!ids) {
                return std::unexpected(ids.error());
            }
            metadata.suppressTokens = std::move(*ids);
            return {};
        }
        case metadata_field::kKvCacheInitValue: {
            auto value = varintField(field);
            if (!value) {
                return std::unexpected(value.error());
            }
            metadata.kvCacheInitValue = static_cast<std::int64_t>(value->scalar);
            return {};
        }
        case metadata_field::kSupportsThinking:
        case metadata_field::kSupportsFunctionCalling: {
            auto value = varintField(field);
            if (!value) {
                return std::unexpected(value.error());
            }
            (field.number == metadata_field::kSupportsThinking ? metadata.supportsThinking : metadata.supportsFunctionCalling) = format::protobufBool(*value);
            return {};
        }
        case metadata_field::kMinRuntimeVersion: {
            auto text = stringField(field);
            if (!text) {
                return std::unexpected(text.error());
            }
            metadata.minRuntimeVersion = std::move(*text);
            return {};
        }
        default:
            return {};
    }
}

}

core::Result<LlmMetadata> decodeLlmMetadata(format::ByteSpan message) {
    LlmMetadata metadata;
    auto decoded = forEachField(message, [&](const ProtobufField& field) {
        return decodeMetadataField(field, metadata);
    });
    if (!decoded) {
        return std::unexpected(decoded.error());
    }
    return metadata;
}

}
