#pragma once

#include <cstdint>
#include <string>
#include <vector>

#include "eversoul/core/failure.h"
#include "eversoul/format/byte_reader.h"

namespace eversoul::tokenizer {

enum class SentencePieceType : std::int32_t {
    Normal = 1,
    Unknown = 2,
    Control = 3,
    UserDefined = 4,
    Byte = 6,
    Unused = 5,
};

struct SentencePiece {
    std::string piece;
    float score;
    SentencePieceType type;
};

struct SentencePieceModel {
    std::vector<SentencePiece> pieces;
    bool addDummyPrefix = true;
    bool removeExtraWhitespaces = true;
    bool byteFallback = false;
    std::int32_t unknownId = 0;
};

[[nodiscard]] core::Result<SentencePieceModel> decodeSentencePieceModel(format::ByteSpan modelBytes);

}
