#include "chat_template/template_error.h"

#include <optional>
#include <string>
#include <string_view>
#include <utility>

namespace eversoul::native::chat_template {

std::string_view templateErrorKindDescription(TemplateErrorKind kind) noexcept {
    switch (kind) {
    case TemplateErrorKind::NonPrimitive: return "not a primitive";
    case TemplateErrorKind::NonKey: return "not a key type";
    case TemplateErrorKind::InvalidOperation: return "invalid operation";
    case TemplateErrorKind::SyntaxError: return "syntax error";
    case TemplateErrorKind::TemplateNotFound: return "template not found";
    case TemplateErrorKind::TooManyArguments: return "too many arguments";
    case TemplateErrorKind::MissingArgument: return "missing argument";
    case TemplateErrorKind::UnknownFilter: return "unknown filter";
    case TemplateErrorKind::UnknownFunction: return "unknown function";
    case TemplateErrorKind::UnknownTest: return "unknown test";
    case TemplateErrorKind::UnknownMethod: return "unknown method";
    case TemplateErrorKind::BadEscape: return "bad string escape";
    case TemplateErrorKind::UndefinedError: return "undefined value";
    case TemplateErrorKind::BadSerialization: return "could not serialize to value";
    case TemplateErrorKind::BadInclude: return "could not render include";
    case TemplateErrorKind::EvalBlock: return "could not render block";
    case TemplateErrorKind::CannotUnpack: return "cannot unpack";
    case TemplateErrorKind::WriteFailure: return "failed to write output";
    case TemplateErrorKind::CannotDeserialize: return "cannot deserialize";
    case TemplateErrorKind::UnknownBlock: return "unknown block";
    }
    return "invalid operation";
}

TemplateError::TemplateError(TemplateErrorKind kind) : kind_(kind) {
    refreshMessage();
}

TemplateError::TemplateError(TemplateErrorKind kind, std::string detail) : kind_(kind), detail_(std::move(detail)) {
    refreshMessage();
}

std::optional<std::size_t> TemplateError::line() const noexcept {
    if (line_ > 0) return line_;
    return std::nullopt;
}

void TemplateError::setDetail(std::string detail) {
    detail_ = std::move(detail);
    refreshMessage();
}

void TemplateError::setFilenameAndSpan(std::string_view filename, TemplateSpan span) {
    name_ = std::string(filename);
    span_ = span;
    line_ = span.startLine;
    refreshMessage();
}

void TemplateError::setFilenameAndLine(std::string_view filename, std::size_t line) {
    name_ = std::string(filename);
    line_ = line;
    refreshMessage();
}

std::string TemplateError::displayText() const {
    return message_;
}

const char* TemplateError::what() const noexcept {
    return message_.c_str();
}

void TemplateError::refreshMessage() {
    message_ = std::string(templateErrorKindDescription(kind_));
    if (detail_) {
        message_.append(": ");
        message_.append(*detail_);
    }
    if (name_) {
        message_.append(" (in ");
        message_.append(*name_);
        message_.push_back(':');
        message_.append(std::to_string(line_));
        message_.push_back(')');
    }
}

}
