#pragma once

#include <functional>
#include <string>
#include <string_view>

namespace eversoul::native::text_format {

class DebugWriter {
public:
    DebugWriter(std::string& output, bool alternate) noexcept;

    void write(std::string_view text);
    [[nodiscard]] bool alternate() const noexcept { return alternate_; }
    [[nodiscard]] DebugWriter withAlternate(bool alternate) noexcept;

    void writeList(std::size_t count, const std::function<void(std::size_t, DebugWriter&)>& writeEntry);
    void writeMap(std::size_t count, const std::function<void(std::size_t, DebugWriter&)>& writeKey,
        const std::function<void(std::size_t, DebugWriter&)>& writeValue);
    void writeStruct(std::string_view name, std::size_t count, const std::function<std::string_view(std::size_t)>& fieldName,
        const std::function<void(std::size_t, DebugWriter&)>& writeField);
    void writeTuple(std::string_view name, std::size_t count, const std::function<void(std::size_t, DebugWriter&)>& writeField);

private:
    DebugWriter(DebugWriter& parent, bool* onNewline, bool alternate) noexcept;

    std::string* output_ = nullptr;
    DebugWriter* parent_ = nullptr;
    bool* onNewline_ = nullptr;
    bool alternate_ = false;
};

}
