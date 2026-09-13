#pragma once

#include <string_view>

#include "chat_template/template_ast.h"
#include "chat_template/template_lexer.h"

namespace eversoul::native::chat_template {

[[nodiscard]] Statement parseTemplate(std::string_view source, std::string_view filename, WhitespaceConfiguration whitespace);
[[nodiscard]] ExpressionPointer parseStandaloneExpression(std::string_view source);

}
