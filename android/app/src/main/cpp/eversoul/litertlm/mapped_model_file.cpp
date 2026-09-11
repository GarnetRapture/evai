#include "eversoul/litertlm/mapped_model_file.h"

#include <cerrno>
#include <fcntl.h>
#include <string_view>
#include <sys/mman.h>
#include <sys/stat.h>
#include <system_error>
#include <unistd.h>
#include <utility>

namespace eversoul::litertlm {
namespace {

std::string describeErrno(std::string_view operation, const std::string& path) {
    return std::string(operation) + ":" + path + ":" + std::error_code(errno, std::generic_category()).message();
}

}

MappedModelFile::MappedModelFile(std::string path, void* address, std::size_t size) noexcept
    : path_(std::move(path)), address_(address), size_(size) {}

MappedModelFile::MappedModelFile(MappedModelFile&& other) noexcept
    : path_(std::move(other.path_)), address_(std::exchange(other.address_, nullptr)), size_(std::exchange(other.size_, 0)) {}

MappedModelFile& MappedModelFile::operator=(MappedModelFile&& other) noexcept {
    if (this != &other) {
        release();
        path_ = std::move(other.path_);
        address_ = std::exchange(other.address_, nullptr);
        size_ = std::exchange(other.size_, 0);
    }
    return *this;
}

MappedModelFile::~MappedModelFile() {
    release();
}

void MappedModelFile::release() noexcept {
    if (address_ != nullptr) {
        ::munmap(address_, size_);
        address_ = nullptr;
        size_ = 0;
    }
}

format::ByteSpan MappedModelFile::bytes() const noexcept {
    return format::ByteSpan(static_cast<const std::byte*>(address_), size_);
}

core::Result<MappedModelFile> MappedModelFile::open(const std::string& path) {
    const int descriptor = ::open(path.c_str(), O_RDONLY | O_CLOEXEC);
    if (descriptor < 0) {
        return core::fail(errno == ENOENT ? core::FailureCode::NotFound : core::FailureCode::Storage, describeErrno("open", path));
    }
    struct stat status {};
    if (::fstat(descriptor, &status) != 0) {
        auto failure = core::fail(core::FailureCode::Storage, describeErrno("fstat", path));
        ::close(descriptor);
        return failure;
    }
    if (status.st_size <= 0) {
        ::close(descriptor);
        return core::fail(core::FailureCode::InvalidModelFile, "empty_model_file:" + path);
    }
    const auto size = static_cast<std::size_t>(status.st_size);
    void* address = ::mmap(nullptr, size, PROT_READ, MAP_PRIVATE, descriptor, 0);
    if (address == MAP_FAILED) {
        auto failure = core::fail(core::FailureCode::Storage, describeErrno("mmap", path));
        ::close(descriptor);
        return failure;
    }
    ::close(descriptor);
    return MappedModelFile(path, address, size);
}

}
