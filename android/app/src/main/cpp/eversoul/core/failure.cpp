#include "eversoul/core/failure.h"

#include <utility>

namespace eversoul::core {

std::unexpected<Failure> fail(FailureCode code, std::string detail) {
    return std::unexpected<Failure>(Failure{code, std::move(detail)});
}

std::string_view failureCodeName(FailureCode code) noexcept {
    switch (code) {
        case FailureCode::InvalidModelFile:
            return "invalid_model_file";
        case FailureCode::NotFound:
            return "not_found";
        case FailureCode::Storage:
            return "storage";
        case FailureCode::NativeRuntime:
            return "native_runtime";
        case FailureCode::ModelNotReady:
            return "model_not_ready";
        case FailureCode::Cancelled:
            return "cancelled";
    }
    return "native_runtime";
}

}
