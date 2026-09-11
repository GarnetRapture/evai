#include "eversoul/tokenizer/pre_tokenizer.h"

#include <array>
#include <span>
#include <string_view>

namespace eversoul::tokenizer {
namespace {

using unicode::CodePointCategory;
using unicode::CodePointClassifier;

constexpr std::array<std::string_view, 7> kContractionSuffixes = {"'s", "'t", "'re", "'ve", "'m", "'ll", "'d"};
constexpr std::size_t kMaxDigitRun = 3;

bool isLetter(const CodePointClassifier& classifier, char32_t codePoint) {
    return classifier.categoryOf(codePoint) == CodePointCategory::Letter;
}

bool isNumber(const CodePointClassifier& classifier, char32_t codePoint) {
    return classifier.categoryOf(codePoint) == CodePointCategory::Number;
}

bool isWhitespace(const CodePointClassifier& classifier, char32_t codePoint) {
    return classifier.categoryOf(codePoint) == CodePointCategory::Whitespace || unicode::isAsciiWhitespace(codePoint);
}

std::u32string toLowerContraction(std::span<const char32_t> codePoints, std::size_t start, std::size_t count) {
    std::u32string result;
    for (std::size_t index = 0; index < count; ++index) {
        char32_t character = codePoints[start + index];
        if (character >= U'A' && character <= U'Z') {
            character = character - U'A' + U'a';
        }
        result.push_back(character);
    }
    return result;
}

std::size_t matchContraction(std::span<const char32_t> codePoints, std::size_t position) {
    if (position >= codePoints.size() || codePoints[position] != U'\'') {
        return 0;
    }
    for (std::string_view suffix : kContractionSuffixes) {
        if (position + suffix.size() > codePoints.size()) {
            continue;
        }
        const std::u32string lowered = toLowerContraction(codePoints, position, suffix.size());
        bool matched = true;
        for (std::size_t index = 0; index < suffix.size(); ++index) {
            if (lowered[index] != static_cast<char32_t>(suffix[index])) {
                matched = false;
                break;
            }
        }
        if (matched) {
            return suffix.size();
        }
    }
    return 0;
}

std::string encodePiece(std::span<const char32_t> codePoints, std::size_t start, std::size_t end) {
    std::string piece;
    for (std::size_t index = start; index < end; ++index) {
        unicode::appendUtf8(codePoints[index], piece);
    }
    return piece;
}

std::size_t consumeGpt2Piece(std::span<const char32_t> codePoints, std::size_t position, const CodePointClassifier& classifier) {
    if (const std::size_t contraction = matchContraction(codePoints, position); contraction > 0) {
        return contraction;
    }
    const char32_t leading = codePoints[position];
    const bool hasLeadingSpace = leading == U' ';
    const std::size_t contentStart = hasLeadingSpace ? position + 1 : position;
    if (contentStart < codePoints.size() && isLetter(classifier, codePoints[contentStart])) {
        std::size_t end = contentStart;
        while (end < codePoints.size() && isLetter(classifier, codePoints[end])) {
            ++end;
        }
        return end - position;
    }
    if (contentStart < codePoints.size() && isNumber(classifier, codePoints[contentStart])) {
        std::size_t end = contentStart;
        while (end < codePoints.size() && isNumber(classifier, codePoints[end])) {
            ++end;
        }
        return end - position;
    }
    if (contentStart < codePoints.size() && !isWhitespace(classifier, codePoints[contentStart])) {
        std::size_t end = contentStart;
        while (end < codePoints.size() && !isWhitespace(classifier, codePoints[end]) && !isLetter(classifier, codePoints[end]) && !isNumber(classifier, codePoints[end])) {
            ++end;
        }
        return end - position;
    }
    std::size_t end = position;
    while (end < codePoints.size() && isWhitespace(classifier, codePoints[end])) {
        ++end;
    }
    if (end < codePoints.size() && end - position > 1) {
        return end - position - 1;
    }
    return end - position;
}

std::size_t consumeQwenPiece(std::span<const char32_t> codePoints, std::size_t position, const CodePointClassifier& classifier) {
    if (const std::size_t contraction = matchContraction(codePoints, position); contraction > 0) {
        return contraction;
    }
    const char32_t leading = codePoints[position];
    const bool leadingIsNewline = leading == U'\r' || leading == U'\n';
    if (!leadingIsNewline && !isLetter(classifier, leading) && !isNumber(classifier, leading) && (position + 1 < codePoints.size() && isLetter(classifier, codePoints[position + 1]))) {
        std::size_t end = position + 1;
        while (end < codePoints.size() && isLetter(classifier, codePoints[end])) {
            ++end;
        }
        return end - position;
    }
    if (isLetter(classifier, leading)) {
        std::size_t end = position;
        while (end < codePoints.size() && isLetter(classifier, codePoints[end])) {
            ++end;
        }
        return end - position;
    }
    if (isNumber(classifier, leading)) {
        std::size_t end = position;
        while (end < codePoints.size() && end - position < kMaxDigitRun && isNumber(classifier, codePoints[end])) {
            ++end;
        }
        return end - position;
    }
    const bool leadingSpace = leading == U' ';
    const std::size_t symbolStart = leadingSpace ? position + 1 : position;
    if (symbolStart < codePoints.size() && !isWhitespace(classifier, codePoints[symbolStart]) && !isLetter(classifier, codePoints[symbolStart]) && !isNumber(classifier, codePoints[symbolStart])) {
        std::size_t end = symbolStart;
        while (end < codePoints.size() && !isWhitespace(classifier, codePoints[end]) && !isLetter(classifier, codePoints[end]) && !isNumber(classifier, codePoints[end])) {
            ++end;
        }
        while (end < codePoints.size() && (codePoints[end] == U'\r' || codePoints[end] == U'\n')) {
            ++end;
        }
        return end - position;
    }
    std::size_t whitespaceEnd = position;
    while (whitespaceEnd < codePoints.size() && isWhitespace(classifier, codePoints[whitespaceEnd])) {
        ++whitespaceEnd;
    }
    std::size_t newlineEnd = position;
    while (newlineEnd < codePoints.size() && isWhitespace(classifier, codePoints[newlineEnd]) && codePoints[newlineEnd] != U'\r' && codePoints[newlineEnd] != U'\n') {
        ++newlineEnd;
    }
    if (newlineEnd < codePoints.size() && (codePoints[newlineEnd] == U'\r' || codePoints[newlineEnd] == U'\n')) {
        std::size_t end = newlineEnd;
        while (end < codePoints.size() && (codePoints[end] == U'\r' || codePoints[end] == U'\n')) {
            ++end;
        }
        return end - position;
    }
    if (whitespaceEnd < codePoints.size() && whitespaceEnd - position > 1) {
        return whitespaceEnd - position - 1;
    }
    return whitespaceEnd - position;
}

}

core::Result<PreTokenizerPattern> recognizePreTokenizerPattern(std::string_view regexPattern) {
    if (regexPattern.find("\\p{N}{1,3}") != std::string_view::npos) {
        return PreTokenizerPattern::Qwen;
    }
    if (regexPattern.find("\\p{L}+") != std::string_view::npos || regexPattern.find("\\p{L}") != std::string_view::npos) {
        return PreTokenizerPattern::Gpt2;
    }
    return core::fail(core::FailureCode::InvalidModelFile, "unsupported_pretokenizer_pattern");
}

PreTokenizer::PreTokenizer(PreTokenizerPattern pattern, bool splitIndividualDigits, const CodePointClassifier& classifier) noexcept
    : pattern_(pattern), splitIndividualDigits_(splitIndividualDigits), classifier_(classifier) {}

std::vector<std::string> PreTokenizer::splitPieceIntoDigits(std::span<const char32_t> piece) const {
    std::vector<std::string> pieces;
    std::size_t index = 0;
    while (index < piece.size()) {
        if (isNumber(classifier_, piece[index])) {
            std::string digit;
            unicode::appendUtf8(piece[index], digit);
            pieces.push_back(std::move(digit));
            ++index;
            continue;
        }
        std::size_t end = index;
        while (end < piece.size() && !isNumber(classifier_, piece[end])) {
            ++end;
        }
        pieces.push_back(encodePiece(piece, index, end));
        index = end;
    }
    return pieces;
}

core::Result<std::vector<std::string>> PreTokenizer::split(std::string_view text) const {
    auto codePointsResult = unicode::decodeUtf8(text);
    if (!codePointsResult) {
        return std::unexpected(codePointsResult.error());
    }
    const std::vector<char32_t>& codePoints = *codePointsResult;
    const std::span<const char32_t> view(codePoints);
    std::vector<std::string> pieces;
    std::size_t position = 0;
    while (position < view.size()) {
        const std::size_t length = pattern_ == PreTokenizerPattern::Qwen
            ? consumeQwenPiece(view, position, classifier_)
            : consumeGpt2Piece(view, position, classifier_);
        const std::size_t consumed = length == 0 ? 1 : length;
        const std::span<const char32_t> piece = view.subspan(position, consumed);
        if (splitIndividualDigits_) {
            for (std::string& digitPiece : splitPieceIntoDigits(piece)) {
                pieces.push_back(std::move(digitPiece));
            }
        }
        else {
            pieces.push_back(encodePiece(view, position, position + consumed));
        }
        position += consumed;
    }
    return pieces;
}

}
