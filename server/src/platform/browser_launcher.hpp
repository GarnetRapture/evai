#pragma once

#include <string>

namespace evai::server::platform {

[[nodiscard]] bool open_default_browser(const std::string& url);

}
