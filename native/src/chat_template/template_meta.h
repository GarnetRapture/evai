#pragma once

#include <set>
#include <string>

#include "chat_template/template_ast.h"

namespace eversoul::native::chat_template {

[[nodiscard]] std::set<std::string> findMacroClosure(const MacroStatement& macro);
[[nodiscard]] std::set<std::string> findUndeclaredVariables(const Statement& statement, bool trackNested);

}
