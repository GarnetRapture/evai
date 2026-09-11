#include "eversoul/tokenizer/sentencepiece_model.h"

#include <utility>

#include "eversoul/format/protobuf_reader.h"

namespace eversoul::tokenizer {
namespace {

using format::ProtobufField;
using format::ProtobufReader;
using format::ProtobufWireType;

namespace model_proto_field {
constexpr std::uint32_t kPiece = 1;
constexpr std::uint32_t kTrainerSpec = 2;
constexpr std::uint32_t kNormalizerSpec = 3;
}

namespace piece_field {
constexpr std::uint32_t kPiece = 1;
constexpr std::uint32_t kScore = 2;
constexpr std::uint32_t kType = 3;
}

namespace trainer_field {
constexpr std::uint32_t kByteFallback = 35;
constexpr std::uint32_t kUnkId = 40;
}

namespace normalizer_field {
constexpr std::uint32_t kAddDummyPrefix = 3;
constexpr std::uint32_t kRemoveExtraWhitespaces = 4;
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

core::Result<SentencePiece> decodePiece(format::ByteSpan message) {
    SentencePiece piece{"", 0.0F, SentencePieceType::Normal};
    auto decoded = forEachField(message, [&](const ProtobufField& field) -> core::Result<void> {
        switch (field.number) {
            case piece_field::kPiece: {
                if (auto checked = format::expectWireType(field, ProtobufWireType::LengthDelimited, "sp_piece_wire"); !checked) {
                    return std::unexpected(checked.error());
                }
                piece.piece = format::protobufString(field);
                return {};
            }
            case piece_field::kScore: {
                auto score = format::protobufFloat32(field);
                if (!score) {
                    return std::unexpected(score.error());
                }
                piece.score = *score;
                return {};
            }
            case piece_field::kType: {
                if (auto checked = format::expectWireType(field, ProtobufWireType::Varint, "sp_type_wire"); !checked) {
                    return std::unexpected(checked.error());
                }
                piece.type = static_cast<SentencePieceType>(format::protobufInt32(field));
                return {};
            }
            default:
                return {};
        }
    });
    if (!decoded) {
        return std::unexpected(decoded.error());
    }
    return piece;
}

core::Result<void> decodeTrainerSpec(format::ByteSpan message, SentencePieceModel& model) {
    return forEachField(message, [&](const ProtobufField& field) -> core::Result<void> {
        if (field.number == trainer_field::kByteFallback) {
            model.byteFallback = format::protobufBool(field);
        }
        else if (field.number == trainer_field::kUnkId) {
            model.unknownId = format::protobufInt32(field);
        }
        return {};
    });
}

core::Result<void> decodeNormalizerSpec(format::ByteSpan message, SentencePieceModel& model) {
    return forEachField(message, [&](const ProtobufField& field) -> core::Result<void> {
        if (field.number == normalizer_field::kAddDummyPrefix) {
            model.addDummyPrefix = format::protobufBool(field);
        }
        else if (field.number == normalizer_field::kRemoveExtraWhitespaces) {
            model.removeExtraWhitespaces = format::protobufBool(field);
        }
        return {};
    });
}

}

core::Result<SentencePieceModel> decodeSentencePieceModel(format::ByteSpan modelBytes) {
    SentencePieceModel model;
    auto decoded = forEachField(modelBytes, [&](const ProtobufField& field) -> core::Result<void> {
        switch (field.number) {
            case model_proto_field::kPiece: {
                if (auto checked = format::expectWireType(field, ProtobufWireType::LengthDelimited, "sp_model_piece_wire"); !checked) {
                    return std::unexpected(checked.error());
                }
                auto piece = decodePiece(field.payload);
                if (!piece) {
                    return std::unexpected(piece.error());
                }
                model.pieces.push_back(std::move(*piece));
                return {};
            }
            case model_proto_field::kTrainerSpec: {
                if (auto checked = format::expectWireType(field, ProtobufWireType::LengthDelimited, "sp_trainer_wire"); !checked) {
                    return std::unexpected(checked.error());
                }
                return decodeTrainerSpec(field.payload, model);
            }
            case model_proto_field::kNormalizerSpec: {
                if (auto checked = format::expectWireType(field, ProtobufWireType::LengthDelimited, "sp_normalizer_wire"); !checked) {
                    return std::unexpected(checked.error());
                }
                return decodeNormalizerSpec(field.payload, model);
            }
            default:
                return {};
        }
    });
    if (!decoded) {
        return std::unexpected(decoded.error());
    }
    if (model.pieces.empty()) {
        return core::fail(core::FailureCode::InvalidModelFile, "sentencepiece_no_pieces");
    }
    return model;
}

}
