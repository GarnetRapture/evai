#pragma once

#include <string>
#include <string_view>

namespace eversoul::native {

[[nodiscard]] std::string jsonEscape(std::string_view text);

}
