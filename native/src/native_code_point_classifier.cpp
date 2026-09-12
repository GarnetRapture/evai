#include "native_code_point_classifier.h"

#include <cwctype>

#ifdef _WIN32
#include <windows.h>
#endif

namespace eversoul::native {

unicode::CodePointCategory NativeCodePointClassifier::categoryOf(char32_t codePoint) const {
#ifdef _WIN32
    if (codePoint > 0xffff) return unicode::CodePointCategory::Other;
    const wchar_t character = static_cast<wchar_t>(codePoint);
    WORD type = 0;
    if (!GetStringTypeW(CT_CTYPE1, &character, 1, &type)) return unicode::CodePointCategory::Other;
    if ((type & C1_ALPHA) != 0) return unicode::CodePointCategory::Letter;
    if ((type & C1_DIGIT) != 0) return unicode::CodePointCategory::Number;
    if ((type & (C1_SPACE | C1_BLANK)) != 0) return unicode::CodePointCategory::Whitespace;
#else
    const wint_t character = static_cast<wint_t>(codePoint);
    if (std::iswalpha(character) != 0) return unicode::CodePointCategory::Letter;
    if (std::iswdigit(character) != 0) return unicode::CodePointCategory::Number;
    if (std::iswspace(character) != 0) return unicode::CodePointCategory::Whitespace;
#endif
    return unicode::CodePointCategory::Other;
}

}
