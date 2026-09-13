#include "json_text/json_text.h"

#include <string>
#include <string_view>

namespace eversoul::native {

std::string jsonEscape(std::string_view text) {
    std::string escaped;
    escaped.reserve(text.size() + 8);
    constexpr char hex[] = "0123456789abcdef";
    for (const unsigned char character : text) {
        switch (character) {
            case '"': escaped += "\\\""; break;
            case '\\': escaped += "\\\\"; break;
            case '\b': escaped += "\\b"; break;
            case '\f': escaped += "\\f"; break;
            case '\n': escaped += "\\n"; break;
            case '\r': escaped += "\\r"; break;
            case '\t': escaped += "\\t"; break;
            default:
                if (character < 0x20) {
                    escaped += "\\u00";
                    escaped.push_back(hex[character >> 4]);
                    escaped.push_back(hex[character & 0x0f]);
                }
                else {
                    escaped.push_back(static_cast<char>(character));
                }
        }
    }
    return escaped;
}

}
