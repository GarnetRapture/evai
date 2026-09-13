#pragma once

#include <cstddef>
#include <cstdint>
#include <exception>
#include <optional>
#include <string>
#include <string_view>

namespace eversoul::native::chat_template {

struct TemplateSpan {
    std::uint16_t startLine = 0;
    std::uint16_t startColumn = 0;
    std::uint32_t startOffset = 0;
    std::uint16_t endLine = 0;
    std::uint16_t endColumn = 0;
    std::uint32_t endOffset = 0;

    friend bool operator==(const TemplateSpan&, const TemplateSpan&) = default;
};

enum class TemplateErrorKind {
    NonPrimitive,
    NonKey,
    InvalidOperation,
    SyntaxError,
    TemplateNotFound,
    TooManyArguments,
    MissingArgument,
    UnknownFilter,
    UnknownTest,
    UnknownFunction,
    UnknownMethod,
    BadEscape,
    UndefinedError,
    BadSerialization,
    CannotDeserialize,
    BadInclude,
    EvalBlock,
    CannotUnpack,
    WriteFailure,
    UnknownBlock,
};

[[nodiscard]] std::string_view templateErrorKindDescription(TemplateErrorKind kind) noexcept;

class TemplateError final : public std::exception {
public:
    explicit TemplateError(TemplateErrorKind kind);
    TemplateError(TemplateErrorKind kind, std::string detail);

    [[nodiscard]] TemplateErrorKind kind() const noexcept { return kind_; }
    [[nodiscard]] const std::optional<std::string>& detail() const noexcept { return detail_; }
    [[nodiscard]] const std::optional<std::string>& name() const noexcept { return name_; }
    [[nodiscard]] std::optional<std::size_t> line() const noexcept;
    [[nodiscard]] const std::optional<TemplateSpan>& span() const noexcept { return span_; }

    void setDetail(std::string detail);
    void setFilenameAndSpan(std::string_view filename, TemplateSpan span);
    void setFilenameAndLine(std::string_view filename, std::size_t line);

    [[nodiscard]] std::string displayText() const;
    [[nodiscard]] const char* what() const noexcept override;

private:
    void refreshMessage();

    TemplateErrorKind kind_;
    std::optional<std::string> detail_;
    std::optional<std::string> name_;
    std::size_t line_ = 0;
    std::optional<TemplateSpan> span_;
    std::string message_;
};

}
