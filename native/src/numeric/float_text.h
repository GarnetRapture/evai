#pragma once

#include <string>

namespace eversoul::native::numeric {

[[nodiscard]] std::string rustFloatDisplay(double value);
[[nodiscard]] std::string rustFloatDebug(double value);
[[nodiscard]] std::string jsonFloatText(double value);

}
