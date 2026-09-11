#pragma once

#include <expected>
#include <string>
#include <string_view>

namespace eversoul::core {

enum class FailureCode {
    InvalidModelFile,
    NotFound,
    Storage,
    NativeRuntime,
    ModelNotReady,
    Cancelled,
};

struct Failure {
    FailureCode code;
    std::string detail;
};

template <typename Value>
using Result = std::expected<Value, Failure>;

[[nodiscard]] std::unexpected<Failure> fail(FailureCode code, std::string detail);

[[nodiscard]] std::string_view failureCodeName(FailureCode code) noexcept;

}
