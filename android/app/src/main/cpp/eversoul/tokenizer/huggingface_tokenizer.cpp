#include "eversoul/tokenizer/huggingface_tokenizer.h"

#include <algorithm>
#include <limits>
#include <string>
#include <utility>

#include "eversoul/format/json_value.h"

namespace eversoul::tokenizer {
namespace {

using format::JsonValue;

constexpr std::int32_t kNoMerge = std::numeric_limits<std::int32_t>::max();

core::Result<const JsonValue*> requireField(const JsonValue& parent, std::string_view key) {
    const JsonValue* value = parent.find(key);
    if (value == nullptr) {
        return core::fail(core::FailureCode::InvalidModelFile, "tokenizer_missing_field:" + std::string(key));
    }
    return value;
}

core::Result<std::string_view> mergePairKey(const JsonValue& mergeEntry, std::string& scratch) {
    if (mergeEntry.isString()) {
        auto text = mergeEntry.asString();
        if (!text) {
            return std::unexpected(text.error());
        }
        return *text;
    }
    auto pair = mergeEntry.asArray();
    if (!pair) {
        return std::unexpected(pair.error());
    }
    if ((*pair)->size() != 2) {
        return core::fail(core::FailureCode::InvalidModelFile, "tokenizer_merge_pair_arity");
    }
    auto left = (**pair)[0].asString();
    auto right = (**pair)[1].asString();
    if (!left) {
        return std::unexpected(left.error());
    }
    if (!right) {
        return std::unexpected(right.error());
    }
    scratch.assign(*left);
    scratch.push_back(' ');
    scratch.append(*right);
    return std::string_view(scratch);
}

core::Result<PreTokenizerPattern> patternFromPreTokenizer(const JsonValue& preTokenizer, bool& splitIndividualDigits) {
    auto typeText = preTokenizer.find("type");
    if (typeText == nullptr) {
        return core::fail(core::FailureCode::InvalidModelFile, "pretokenizer_missing_type");
    }
    auto type = typeText->asString();
    if (!type) {
        return std::unexpected(type.error());
    }
    if (*type == "Digits") {
        if (const JsonValue* individual = preTokenizer.find("individual_digits"); individual != nullptr) {
            auto flag = individual->asBoolean();
            if (flag && *flag) {
                splitIndividualDigits = true;
            }
        }
        return core::fail(core::FailureCode::NotFound, "digits_only");
    }
    if (*type == "Split") {
        auto pattern = requireField(preTokenizer, "pattern");
        if (!pattern) {
            return std::unexpected(pattern.error());
        }
        const JsonValue* regexValue = (*pattern)->find("Regex");
        if (regexValue == nullptr) {
            return core::fail(core::FailureCode::InvalidModelFile, "split_pattern_not_regex");
        }
        auto regexText = regexValue->asString();
        if (!regexText) {
            return std::unexpected(regexText.error());
        }
        return recognizePreTokenizerPattern(*regexText);
    }
    if (*type == "ByteLevel") {
        if (const JsonValue* useRegex = preTokenizer.find("use_regex"); useRegex != nullptr) {
            auto flag = useRegex->asBoolean();
            if (flag && !*flag) {
                return core::fail(core::FailureCode::NotFound, "bytelevel_no_regex");
            }
        }
        return PreTokenizerPattern::Gpt2;
    }
    return core::fail(core::FailureCode::InvalidModelFile, "unsupported_pretokenizer_type");
}

core::Result<PreTokenizerPattern> resolvePreTokenizer(const JsonValue& root, bool& splitIndividualDigits) {
    const JsonValue* preTokenizer = root.find("pre_tokenizer");
    if (preTokenizer == nullptr || preTokenizer->kind() == format::JsonKind::Null) {
        return PreTokenizerPattern::Gpt2;
    }
    auto typeText = preTokenizer->find("type");
    if (typeText != nullptr) {
        auto type = typeText->asString();
        if (type && *type == "Sequence") {
            auto sequence = requireField(*preTokenizer, "pretokenizers");
            if (!sequence) {
                return std::unexpected(sequence.error());
            }
            auto entries = (*sequence)->asArray();
            if (!entries) {
                return std::unexpected(entries.error());
            }
            PreTokenizerPattern resolved = PreTokenizerPattern::Gpt2;
            bool resolvedFound = false;
            for (const JsonValue& entry : **entries) {
                auto pattern = patternFromPreTokenizer(entry, splitIndividualDigits);
                if (pattern) {
                    resolved = *pattern;
                    resolvedFound = true;
                }
                else if (pattern.error().code != core::FailureCode::NotFound) {
                    return pattern;
                }
            }
            if (!resolvedFound) {
                return core::fail(core::FailureCode::InvalidModelFile, "pretokenizer_sequence_unresolved");
            }
            return resolved;
        }
    }
    return patternFromPreTokenizer(*preTokenizer, splitIndividualDigits);
}

}

core::Result<std::unique_ptr<HuggingFaceTokenizer>> HuggingFaceTokenizer::create(
    std::string_view tokenizerJson, std::shared_ptr<const unicode::CodePointClassifier> classifier) {
    if (classifier == nullptr) {
        return core::fail(core::FailureCode::NativeRuntime, "null_code_point_classifier");
    }
    auto rootResult = format::parseJson(tokenizerJson);
    if (!rootResult) {
        return std::unexpected(rootResult.error());
    }
    const JsonValue& root = *rootResult;

    bool splitIndividualDigits = false;
    auto pattern = resolvePreTokenizer(root, splitIndividualDigits);
    if (!pattern) {
        return std::unexpected(pattern.error());
    }

    auto model = requireField(root, "model");
    if (!model) {
        return std::unexpected(model.error());
    }
    auto vocabField = requireField(**model, "vocab");
    if (!vocabField) {
        return std::unexpected(vocabField.error());
    }
    auto vocabObject = (*vocabField)->asObject();
    if (!vocabObject) {
        return std::unexpected(vocabObject.error());
    }

    std::unordered_map<std::string, TokenId> vocab;
    vocab.reserve((*vocabObject)->size());
    std::int32_t maxId = -1;
    for (const auto& [token, idValue] : **vocabObject) {
        auto id = idValue.asNumber();
        if (!id) {
            return std::unexpected(id.error());
        }
        const auto tokenId = static_cast<TokenId>(*id);
        vocab.emplace(token, tokenId);
        maxId = std::max(maxId, tokenId);
    }

    auto mergesField = requireField(**model, "merges");
    if (!mergesField) {
        return std::unexpected(mergesField.error());
    }
    auto mergesArray = (*mergesField)->asArray();
    if (!mergesArray) {
        return std::unexpected(mergesArray.error());
    }
    std::unordered_map<std::string, std::int32_t> mergeRanks;
    mergeRanks.reserve((*mergesArray)->size());
    std::int32_t rank = 0;
    std::string scratch;
    for (const JsonValue& mergeEntry : **mergesArray) {
        auto key = mergePairKey(mergeEntry, scratch);
        if (!key) {
            return std::unexpected(key.error());
        }
        mergeRanks.emplace(std::string(*key), rank++);
    }

    std::vector<SpecialTokenEntry> specialTokens;
    if (const JsonValue* addedTokens = root.find("added_tokens"); addedTokens != nullptr && addedTokens->isArray()) {
        auto entries = addedTokens->asArray();
        if (!entries) {
            return std::unexpected(entries.error());
        }
        for (const JsonValue& entry : **entries) {
            const JsonValue* special = entry.find("special");
            bool isSpecial = false;
            if (special != nullptr) {
                auto flag = special->asBoolean();
                if (flag) {
                    isSpecial = *flag;
                }
            }
            auto content = requireField(entry, "content");
            if (!content) {
                return std::unexpected(content.error());
            }
            auto contentText = (*content)->asString();
            if (!contentText) {
                return std::unexpected(contentText.error());
            }
            auto idValue = requireField(entry, "id");
            if (!idValue) {
                return std::unexpected(idValue.error());
            }
            auto id = (*idValue)->asNumber();
            if (!id) {
                return std::unexpected(id.error());
            }
            const auto tokenId = static_cast<TokenId>(*id);
            maxId = std::max(maxId, tokenId);
            vocab.insert_or_assign(std::string(*contentText), tokenId);
            if (isSpecial) {
                specialTokens.push_back(SpecialTokenEntry{std::string(*contentText), tokenId});
            }
        }
    }

    std::vector<std::string> idToToken(static_cast<std::size_t>(maxId + 1));
    for (const auto& [token, id] : vocab) {
        if (id >= 0 && static_cast<std::size_t>(id) < idToToken.size()) {
            idToToken[static_cast<std::size_t>(id)] = token;
        }
    }
    std::ranges::sort(specialTokens, [](const SpecialTokenEntry& left, const SpecialTokenEntry& right) {
        return left.content.size() > right.content.size();
    });

    PreTokenizer preTokenizer(*pattern, splitIndividualDigits, *classifier);
    return std::unique_ptr<HuggingFaceTokenizer>(new HuggingFaceTokenizer(
        std::move(classifier), std::move(preTokenizer), std::move(vocab), std::move(idToToken), std::move(mergeRanks), std::move(specialTokens)));
}

HuggingFaceTokenizer::HuggingFaceTokenizer(
    std::shared_ptr<const unicode::CodePointClassifier> classifier,
    PreTokenizer preTokenizer,
    std::unordered_map<std::string, TokenId> vocab,
    std::vector<std::string> idToToken,
    std::unordered_map<std::string, std::int32_t> mergeRanks,
    std::vector<SpecialTokenEntry> specialTokens)
    : classifier_(std::move(classifier)),
      preTokenizer_(std::move(preTokenizer)),
      vocab_(std::move(vocab)),
      idToToken_(std::move(idToToken)),
      mergeRanks_(std::move(mergeRanks)),
      specialTokens_(std::move(specialTokens)) {
    for (const SpecialTokenEntry& entry : specialTokens_) {
        specialTokenIds_.emplace(entry.id, true);
    }
}

std::vector<std::string> HuggingFaceTokenizer::applyMerges(std::vector<std::string> symbols) const {
    while (symbols.size() > 1) {
        std::int32_t bestRank = kNoMerge;
        std::size_t bestIndex = 0;
        for (std::size_t index = 0; index + 1 < symbols.size(); ++index) {
            std::string pair = symbols[index];
            pair.push_back(' ');
            pair.append(symbols[index + 1]);
            const auto match = mergeRanks_.find(pair);
            if (match != mergeRanks_.end() && match->second < bestRank) {
                bestRank = match->second;
                bestIndex = index;
            }
        }
        if (bestRank == kNoMerge) {
            break;
        }
        symbols[bestIndex].append(symbols[bestIndex + 1]);
        symbols.erase(symbols.begin() + static_cast<std::ptrdiff_t>(bestIndex) + 1);
    }
    return symbols;
}

core::Result<void> HuggingFaceTokenizer::encodePiece(std::string_view piece, std::vector<TokenId>& output) const {
    const std::string encoded = byteLevel_.encodeBytes(piece);
    auto codePoints = unicode::decodeUtf8(encoded);
    if (!codePoints) {
        return std::unexpected(codePoints.error());
    }
    std::vector<std::string> symbols;
    symbols.reserve(codePoints->size());
    for (char32_t codePoint : *codePoints) {
        std::string symbol;
        unicode::appendUtf8(codePoint, symbol);
        symbols.push_back(std::move(symbol));
    }
    for (const std::string& symbol : applyMerges(std::move(symbols))) {
        const auto match = vocab_.find(symbol);
        if (match == vocab_.end()) {
            return core::fail(core::FailureCode::NativeRuntime, "tokenizer_unknown_symbol");
        }
        output.push_back(match->second);
    }
    return {};
}

core::Result<std::vector<TokenId>> HuggingFaceTokenizer::encode(std::string_view text) const {
    std::vector<TokenId> tokens;
    std::size_t cursor = 0;
    while (cursor < text.size()) {
        std::size_t nextSpecial = std::string_view::npos;
        std::size_t specialLength = 0;
        TokenId specialId = 0;
        for (const SpecialTokenEntry& entry : specialTokens_) {
            const std::size_t found = text.find(entry.content, cursor);
            if (found != std::string_view::npos && (found < nextSpecial || (found == nextSpecial && entry.content.size() > specialLength))) {
                nextSpecial = found;
                specialLength = entry.content.size();
                specialId = entry.id;
            }
        }
        const std::size_t segmentEnd = nextSpecial == std::string_view::npos ? text.size() : nextSpecial;
        if (segmentEnd > cursor) {
            auto pieces = preTokenizer_.split(text.substr(cursor, segmentEnd - cursor));
            if (!pieces) {
                return std::unexpected(pieces.error());
            }
            for (const std::string& piece : *pieces) {
                if (auto encoded = encodePiece(piece, tokens); !encoded) {
                    return std::unexpected(encoded.error());
                }
            }
        }
        if (nextSpecial == std::string_view::npos) {
            break;
        }
        tokens.push_back(specialId);
        cursor = nextSpecial + specialLength;
    }
    return tokens;
}

core::Result<std::string> HuggingFaceTokenizer::decode(std::span<const TokenId> tokens, bool skipSpecialTokens) const {
    std::string bytes;
    for (const TokenId token : tokens) {
        if (token < 0 || static_cast<std::size_t>(token) >= idToToken_.size()) {
            return core::fail(core::FailureCode::NativeRuntime, "tokenizer_token_out_of_range");
        }
        if (skipSpecialTokens && specialTokenIds_.contains(token)) {
            continue;
        }
        const std::string& piece = idToToken_[static_cast<std::size_t>(token)];
        auto codePoints = unicode::decodeUtf8(piece);
        if (!codePoints) {
            return std::unexpected(codePoints.error());
        }
        for (char32_t codePoint : *codePoints) {
            const auto rawByte = byteLevel_.decodeCharacter(codePoint);
            if (!rawByte) {
                unicode::appendUtf8(codePoint, bytes);
                continue;
            }
            bytes.push_back(static_cast<char>(*rawByte));
        }
    }
    return bytes;
}

core::Result<TokenId> HuggingFaceTokenizer::tokenToId(std::string_view token) const {
    const auto match = vocab_.find(std::string(token));
    if (match == vocab_.end()) {
        return core::fail(core::FailureCode::NotFound, "unknown_token");
    }
    return match->second;
}

std::int32_t HuggingFaceTokenizer::vocabSize() const noexcept {
    return static_cast<std::int32_t>(idToToken_.size());
}

bool HuggingFaceTokenizer::isSpecialToken(TokenId token) const noexcept {
    return specialTokenIds_.contains(token);
}

}
