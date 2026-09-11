#pragma once

#include <cstddef>
#include <string>

#include "eversoul/core/failure.h"
#include "eversoul/format/byte_reader.h"

namespace eversoul::litertlm {

class MappedModelFile {
public:
    [[nodiscard]] static core::Result<MappedModelFile> open(const std::string& path);

    MappedModelFile(const MappedModelFile&) = delete;
    MappedModelFile& operator=(const MappedModelFile&) = delete;
    MappedModelFile(MappedModelFile&& other) noexcept;
    MappedModelFile& operator=(MappedModelFile&& other) noexcept;
    ~MappedModelFile();

    [[nodiscard]] format::ByteSpan bytes() const noexcept;
    [[nodiscard]] const std::string& path() const noexcept { return path_; }

private:
    MappedModelFile(std::string path, void* address, std::size_t size) noexcept;
    void release() noexcept;

    std::string path_;
    void* address_ = nullptr;
    std::size_t size_ = 0;
};

}
