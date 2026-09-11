#include "eversoul/tokenizer/sentencepiece_tokenizer.h"

#include <algorithm>
#include <charconv>
#include <limits>
#include <utility>

#include "eversoul/unicode/code_point_category.h"

namespace eversoul::tokenizer {
namespace {

constexpr std::string_view kSpaceMarker = "\xe2\x96\x81";
constexpr float kUnknownPenalty = 10.0F;

std::optional<std::uint8_t> parseByteToken(std::string_view piece) {
    if (piece.size() != 6 || !piece.starts_with("<0x") || piece.back() != '>') {
        return std::nullopt;
    }
    std::uint32_t value = 0;
    const auto result = std::from_chars(piece.data() + 3, piece.data() + 5, value, 16);
    if (result.ec != std::errc() || result.ptr != piece.data() + 5) {
        return std::nullopt;
    }
    return static_cast<std::uint8_t>(value);
}

}

core::Result<std::unique_ptr<SentencePieceTokenizer>> SentencePieceTokenizer::create(format::ByteSpan modelBytes) {
    auto model = decodeSentencePieceModel(modelBytes);
    if (!model) {
        return std::unexpected(model.error());
    }
    return std::unique_ptr<SentencePieceTokenizer>(new SentencePieceTokenizer(std::move(*model)));
}

SentencePieceTokenizer::SentencePieceTokenizer(SentencePieceModel model) : model_(std::move(model)) {
    unknownId_ = static_cast<TokenId>(model_.unknownId);
    byteTokenId_.fill(-1);
    for (std::size_t index = 0; index < model_.pieces.size(); ++index) {
        const SentencePiece& piece = model_.pieces[index];
        const auto tokenId = static_cast<TokenId>(index);
        pieceToId_.emplace(piece.piece, tokenId);
        maxPieceBytes_ = std::max(maxPieceBytes_, piece.piece.size());
        if (piece.type == SentencePieceType::Byte) {
            if (const auto byteValue = parseByteToken(piece.piece); byteValue) {
                byteTokenId_[*byteValue] = tokenId;
                hasByteTokens_ = true;
            }
        }
    }
}

std::string SentencePieceTokenizer::normalize(std::string_view text) const {
    std::string collapsed;
    collapsed.reserve(text.size());
    bool previousSpace = false;
    for (const char character : text) {
        const bool isSpace = character == ' ' || character == '\t';
        if (isSpace && model_.removeExtraWhitespaces) {
            if (previousSpace) {
                continue;
            }
            previousSpace = true;
            collapsed.push_back(' ');
            continue;
        }
        previousSpace = false;
        collapsed.push_back(character);
    }
    if (model_.removeExtraWhitespaces) {
        while (!collapsed.empty() && collapsed.back() == ' ') {
            collapsed.pop_back();
        }
        std::size_t start = 0;
        while (start < collapsed.size() && collapsed[start] == ' ') {
            ++start;
        }
        collapsed.erase(0, start);
    }
    std::string normalized;
    normalized.reserve(collapsed.size() + kSpaceMarker.size());
    if (model_.addDummyPrefix) {
        normalized.append(kSpaceMarker);
    }
    for (const char character : collapsed) {
        if (character == ' ') {
            normalized.append(kSpaceMarker);
        }
        else {
            normalized.push_back(character);
        }
    }
    return normalized;
}

core::Result<std::vector<TokenId>> SentencePieceTokenizer::viterbiEncode(std::string_view normalized) const {
    const std::size_t length = normalized.size();
    constexpr float kNegativeInfinity = -std::numeric_limits<float>::infinity();
    std::vector<float> bestScore(length + 1, kNegativeInfinity);
    std::vector<std::size_t> backPointer(length + 1, 0);
    std::vector<TokenId> backToken(length + 1, -1);
    std::vector<bool> backIsByte(length + 1, false);
    bestScore[0] = 0.0F;

    for (std::size_t start = 0; start < length; ++start) {
        if (bestScore[start] == kNegativeInfinity) {
            continue;
        }
        const std::size_t maxEnd = std::min(length, start + maxPieceBytes_);
        bool matchedAny = false;
        for (std::size_t end = start + 1; end <= maxEnd; ++end) {
            const std::string_view candidate = normalized.substr(start, end - start);
            const auto match = pieceToId_.find(std::string(candidate));
            if (match == pieceToId_.end()) {
                continue;
            }
            if (model_.pieces[static_cast<std::size_t>(match->second)].type == SentencePieceType::Unused) {
                continue;
            }
            matchedAny = true;
            const float score = bestScore[start] + model_.pieces[static_cast<std::size_t>(match->second)].score;
            if (score > bestScore[end]) {
                bestScore[end] = score;
                backPointer[end] = start;
                backToken[end] = match->second;
                backIsByte[end] = false;
            }
        }
        const std::size_t byteEnd = start + 1;
        const float fallbackScore = bestScore[start] - kUnknownPenalty;
        if ((!matchedAny || hasByteTokens_) && fallbackScore > bestScore[byteEnd]) {
            bestScore[byteEnd] = fallbackScore;
            backPointer[byteEnd] = start;
            backToken[byteEnd] = -1;
            backIsByte[byteEnd] = true;
        }
    }

    if (bestScore[length] == kNegativeInfinity) {
        return core::fail(core::FailureCode::NativeRuntime, "sentencepiece_no_path");
    }
    std::vector<TokenId> reversed;
    std::size_t position = length;
    while (position > 0) {
        const std::size_t previous = backPointer[position];
        if (backIsByte[position]) {
            const auto rawByte = static_cast<std::uint8_t>(normalized[previous]);
            if (hasByteTokens_ && byteTokenId_[rawByte] >= 0) {
                reversed.push_back(byteTokenId_[rawByte]);
            }
            else {
                reversed.push_back(unknownId_);
            }
        }
        else {
            reversed.push_back(backToken[position]);
        }
        position = previous;
    }
    std::ranges::reverse(reversed);
    return reversed;
}

core::Result<std::vector<TokenId>> SentencePieceTokenizer::encode(std::string_view text) const {
    return viterbiEncode(normalize(text));
}

core::Result<std::string> SentencePieceTokenizer::decode(std::span<const TokenId> tokens, bool skipSpecialTokens) const {
    std::string text;
    std::string pendingBytes;
    const auto flushBytes = [&]() {
        if (!pendingBytes.empty()) {
            text.append(pendingBytes);
            pendingBytes.clear();
        }
    };
    for (const TokenId token : tokens) {
        if (token < 0 || static_cast<std::size_t>(token) >= model_.pieces.size()) {
            return core::fail(core::FailureCode::NativeRuntime, "sentencepiece_token_out_of_range");
        }
        const SentencePiece& piece = model_.pieces[static_cast<std::size_t>(token)];
        if (piece.type == SentencePieceType::Byte) {
            if (const auto byteValue = parseByteToken(piece.piece); byteValue) {
                pendingBytes.push_back(static_cast<char>(*byteValue));
                continue;
            }
        }
        flushBytes();
        if (skipSpecialTokens && (piece.type == SentencePieceType::Control || piece.type == SentencePieceType::Unknown)) {
            continue;
        }
        std::string_view view(piece.piece);
        std::size_t offset = 0;
        while ((offset = view.find(kSpaceMarker, offset)) != std::string_view::npos) {
            text.append(view.substr(0, offset));
            text.push_back(' ');
            view.remove_prefix(offset + kSpaceMarker.size());
            offset = 0;
        }
        text.append(view);
    }
    flushBytes();
    return text;
}

core::Result<TokenId> SentencePieceTokenizer::tokenToId(std::string_view token) const {
    const auto match = pieceToId_.find(std::string(token));
    if (match == pieceToId_.end()) {
        return core::fail(core::FailureCode::NotFound, "unknown_token");
    }
    return match->second;
}

std::int32_t SentencePieceTokenizer::vocabSize() const noexcept {
    return static_cast<std::int32_t>(model_.pieces.size());
}

bool SentencePieceTokenizer::isSpecialToken(TokenId token) const noexcept {
    if (token < 0 || static_cast<std::size_t>(token) >= model_.pieces.size()) {
        return false;
    }
    const SentencePieceType type = model_.pieces[static_cast<std::size_t>(token)].type;
    return type == SentencePieceType::Control || type == SentencePieceType::Unknown;
}

}
