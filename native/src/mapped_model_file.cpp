#include "eversoul/litertlm/mapped_model_file.h"

#include <cerrno>
#include <filesystem>
#include <limits>
#include <string_view>
#include <system_error>
#include <utility>

#ifdef _WIN32
#include <windows.h>
#else
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>
#endif

namespace eversoul::litertlm {
namespace {

#ifdef _WIN32
std::string windowsError(std::string_view operation, const std::string& path) {
    return std::string(operation) + ':' + path + ":win32_" + std::to_string(GetLastError());
}
#else
std::string posixError(std::string_view operation, const std::string& path) {
    return std::string(operation) + ':' + path + ':' + std::error_code(errno, std::generic_category()).message();
}
#endif

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
    if (address_ == nullptr) return;
#ifdef _WIN32
    UnmapViewOfFile(address_);
#else
    ::munmap(address_, size_);
#endif
    address_ = nullptr;
    size_ = 0;
}

format::ByteSpan MappedModelFile::bytes() const noexcept {
    return format::ByteSpan(static_cast<const std::byte*>(address_), size_);
}

core::Result<MappedModelFile> MappedModelFile::open(const std::string& path) {
#ifdef _WIN32
    const std::filesystem::path nativePath(std::u8string(
        reinterpret_cast<const char8_t*>(path.data()),
        reinterpret_cast<const char8_t*>(path.data() + path.size())));
    HANDLE file = CreateFileW(nativePath.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING,
        FILE_ATTRIBUTE_NORMAL | FILE_FLAG_RANDOM_ACCESS, nullptr);
    if (file == INVALID_HANDLE_VALUE) {
        return core::fail(GetLastError() == ERROR_FILE_NOT_FOUND
            ? core::FailureCode::NotFound : core::FailureCode::Storage, windowsError("open", path));
    }
    LARGE_INTEGER length{};
    if (!GetFileSizeEx(file, &length)) {
        auto failure = core::fail(core::FailureCode::Storage, windowsError("size", path));
        CloseHandle(file);
        return failure;
    }
    if (length.QuadPart <= 0 || static_cast<unsigned long long>(length.QuadPart) > std::numeric_limits<std::size_t>::max()) {
        CloseHandle(file);
        return core::fail(core::FailureCode::InvalidModelFile, "invalid_model_file_size:" + path);
    }
    HANDLE mapping = CreateFileMappingW(file, nullptr, PAGE_READONLY, 0, 0, nullptr);
    if (mapping == nullptr) {
        auto failure = core::fail(core::FailureCode::Storage, windowsError("map", path));
        CloseHandle(file);
        return failure;
    }
    void* address = MapViewOfFile(mapping, FILE_MAP_READ, 0, 0, 0);
    if (address == nullptr) {
        auto failure = core::fail(core::FailureCode::Storage, windowsError("map_view", path));
        CloseHandle(mapping);
        CloseHandle(file);
        return failure;
    }
    CloseHandle(mapping);
    CloseHandle(file);
    return MappedModelFile(path, address, static_cast<std::size_t>(length.QuadPart));
#else
    const int descriptor = ::open(path.c_str(), O_RDONLY | O_CLOEXEC);
    if (descriptor < 0) {
        return core::fail(errno == ENOENT ? core::FailureCode::NotFound : core::FailureCode::Storage, posixError("open", path));
    }
    struct stat status {};
    if (::fstat(descriptor, &status) != 0) {
        auto failure = core::fail(core::FailureCode::Storage, posixError("fstat", path));
        ::close(descriptor);
        return failure;
    }
    if (status.st_size <= 0 || static_cast<unsigned long long>(status.st_size) > std::numeric_limits<std::size_t>::max()) {
        ::close(descriptor);
        return core::fail(core::FailureCode::InvalidModelFile, "invalid_model_file_size:" + path);
    }
    const auto size = static_cast<std::size_t>(status.st_size);
    void* address = ::mmap(nullptr, size, PROT_READ, MAP_PRIVATE, descriptor, 0);
    if (address == MAP_FAILED) {
        auto failure = core::fail(core::FailureCode::Storage, posixError("mmap", path));
        ::close(descriptor);
        return failure;
    }
    ::close(descriptor);
    return MappedModelFile(path, address, size);
#endif
}

}
