#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <map>
#include <memory>
#include <span>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "litert/c/litert_common.h"
#include "litert/c/litert_compiled_model.h"
#include "litert/c/litert_environment.h"
#include "litert/c/litert_model.h"
#include "litert/c/litert_model_types.h"
#include "litert/c/litert_options.h"
#include "litert/c/litert_tensor_buffer.h"
#include "litert/c/litert_tensor_buffer_types.h"

#include "eversoul/inference/compiled_graph_factory.h"
#include "eversoul/inference/tensor.h"

namespace eversoul::inference {
namespace {

constexpr std::array<std::string_view, 2> kTokenNames = {"tokens", "token_ids"};
constexpr std::array<std::string_view, 2> kPositionNames = {"input_pos", "positions"};
constexpr std::array<std::string_view, 2> kMaskNames = {"attn_mask", "mask"};
constexpr std::array<std::string_view, 3> kLocalMaskNames = {"local_mask", "attn_mask_local", "local_attn_mask"};
constexpr std::array<std::string_view, 1> kLogitsNames = {"logits"};

bool matchesAny(std::string_view name, std::span<const std::string_view> candidates) {
    return std::ranges::find(candidates, name) != candidates.end();
}

core::Result<TensorElementType> mapElementType(LiteRtElementType type) {
    switch (type) {
        case kLiteRtElementTypeFloat32:
            return TensorElementType::Float32;
        case kLiteRtElementTypeFloat16:
            return TensorElementType::Float16;
        case kLiteRtElementTypeInt32:
            return TensorElementType::Int32;
        case kLiteRtElementTypeBool:
            return TensorElementType::Bool;
        default:
            return core::fail(core::FailureCode::NativeRuntime, "unsupported_tensor_element_type");
    }
}

struct TensorHandle {
    LiteRtTensorBuffer buffer;
    std::string name;
};

struct SignatureRuntime {
    LiteRtSignature signature;
    LiteRtParamIndex index;
    std::vector<TensorHandle> inputs;
    std::vector<TensorHandle> outputs;
    std::vector<LiteRtTensorBuffer> inputHandles;
    std::vector<LiteRtTensorBuffer> outputHandles;
    std::vector<float> outputScratch;
};

class LiteRtCompiledGraph final : public CompiledGraph {
public:
    LiteRtCompiledGraph(LiteRtEnvironment environment, LiteRtModel model, LiteRtOptions options, LiteRtCompiledModel compiledModel)
        : environment_(environment), model_(model), options_(options), compiledModel_(compiledModel) {}

    LiteRtCompiledGraph(const LiteRtCompiledGraph&) = delete;
    LiteRtCompiledGraph& operator=(const LiteRtCompiledGraph&) = delete;

    ~LiteRtCompiledGraph() override {
        for (auto& [key, runtime] : runtimes_) {
            for (TensorHandle& handle : runtime.inputs) {
                LiteRtDestroyTensorBuffer(handle.buffer);
            }
            for (TensorHandle& handle : runtime.outputs) {
                LiteRtDestroyTensorBuffer(handle.buffer);
            }
        }
        LiteRtDestroyCompiledModel(compiledModel_);
        LiteRtDestroyOptions(options_);
        LiteRtDestroyModel(model_);
        LiteRtDestroyEnvironment(environment_);
    }

    [[nodiscard]] core::Result<void> initialize() {
        LiteRtParamIndex count = 0;
        if (LiteRtGetNumModelSignatures(model_, &count) != kLiteRtStatusOk) {
            return core::fail(core::FailureCode::NativeRuntime, "signature_count_failed");
        }
        for (LiteRtParamIndex index = 0; index < count; ++index) {
            LiteRtSignature signature = nullptr;
            if (LiteRtGetModelSignature(model_, index, &signature) != kLiteRtStatusOk) {
                return core::fail(core::FailureCode::NativeRuntime, "signature_fetch_failed");
            }
            const char* key = nullptr;
            if (LiteRtGetSignatureKey(signature, &key) != kLiteRtStatusOk || key == nullptr) {
                return core::fail(core::FailureCode::NativeRuntime, "signature_key_failed");
            }
            const std::string keyString(key);
            signatureKeys_.push_back(keyString);
            if (auto built = buildRuntime(keyString, signature, index); !built) {
                return built;
            }
        }
        return {};
    }

    std::vector<std::string> signatureKeys() const override {
        return signatureKeys_;
    }

    core::Result<ModelSignatureNames> signatureIo(std::string_view signature) const override {
        const SignatureRuntime* runtime = findRuntime(signature);
        if (runtime == nullptr) {
            return core::fail(core::FailureCode::NativeRuntime, "unknown_signature");
        }
        ModelSignatureNames names;
        for (const TensorHandle& input : runtime->inputs) {
            const std::string_view view(input.name);
            if (matchesAny(view, kTokenNames)) {
                names.inputTokens = input.name;
            }
            else if (matchesAny(view, kPositionNames)) {
                names.inputPositions = input.name;
            }
            else if (matchesAny(view, kMaskNames)) {
                names.inputMask = input.name;
            }
            else if (matchesAny(view, kLocalMaskNames)) {
                names.inputLocalMask = input.name;
            }
        }
        for (const TensorHandle& output : runtime->outputs) {
            if (matchesAny(std::string_view(output.name), kLogitsNames)) {
                names.outputLogits = output.name;
            }
        }
        if (names.inputTokens.empty() || names.inputPositions.empty() || names.outputLogits.empty()) {
            return core::fail(core::FailureCode::NativeRuntime, "signature_io_incomplete");
        }
        return names;
    }

    core::Result<TensorShape> inputShape(std::string_view signature, std::string_view tensor) const override {
        LiteRtRankedTensorType type{};
        if (auto resolved = inputTensorType(signature, tensor, type); !resolved) {
            return std::unexpected(resolved.error());
        }
        TensorShape shape;
        for (std::uint32_t dimension = 0; dimension < type.layout.rank; ++dimension) {
            shape.dimensions.push_back(type.layout.dimensions[dimension]);
        }
        return shape;
    }

    core::Result<TensorElementType> inputType(std::string_view signature, std::string_view tensor) const override {
        LiteRtRankedTensorType type{};
        if (auto resolved = inputTensorType(signature, tensor, type); !resolved) {
            return std::unexpected(resolved.error());
        }
        return mapElementType(type.element_type);
    }

    core::Result<TensorElementType> outputType(std::string_view signature, std::string_view tensor) const override {
        LiteRtRankedTensorType type{};
        if (auto resolved = outputTensorType(signature, tensor, type); !resolved) {
            return std::unexpected(resolved.error());
        }
        return mapElementType(type.element_type);
    }

    core::Result<std::int32_t> vocabSize(std::string_view signature) const override {
        auto names = signatureIo(signature);
        if (!names) {
            return std::unexpected(names.error());
        }
        LiteRtRankedTensorType type{};
        if (auto resolved = outputTensorType(signature, names->outputLogits, type); !resolved) {
            return std::unexpected(resolved.error());
        }
        if (type.layout.rank == 0) {
            return core::fail(core::FailureCode::NativeRuntime, "logits_rank_zero");
        }
        return type.layout.dimensions[type.layout.rank - 1];
    }

    core::Result<void> writeInputInt32(std::string_view signature, std::string_view tensor, std::span<const std::int32_t> values) override {
        return writeInput(signature, tensor, std::as_bytes(values));
    }

    core::Result<void> writeInputFloat(std::string_view signature, std::string_view tensor, std::span<const float> values) override {
        return writeInput(signature, tensor, std::as_bytes(values));
    }

    core::Result<void> writeInputBool(std::string_view signature, std::string_view tensor, std::span<const std::uint8_t> values) override {
        return writeInput(signature, tensor, std::as_bytes(values));
    }

    core::Result<void> run(std::string_view signature) override {
        SignatureRuntime* runtime = findRuntime(signature);
        if (runtime == nullptr) {
            return core::fail(core::FailureCode::NativeRuntime, "unknown_signature");
        }
        const LiteRtStatus status = LiteRtRunCompiledModel(
            compiledModel_, runtime->index,
            runtime->inputHandles.size(), runtime->inputHandles.data(),
            runtime->outputHandles.size(), runtime->outputHandles.data());
        if (status != kLiteRtStatusOk) {
            return core::fail(core::FailureCode::NativeRuntime, "compiled_model_run_failed");
        }
        return {};
    }

    core::Result<std::span<const float>> readOutputFloat(std::string_view signature, std::string_view tensor) override {
        SignatureRuntime* runtime = findRuntime(signature);
        if (runtime == nullptr) {
            return core::fail(core::FailureCode::NativeRuntime, "unknown_signature");
        }
        const TensorHandle* handle = findTensor(runtime->outputs, tensor);
        if (handle == nullptr) {
            return core::fail(core::FailureCode::NativeRuntime, "output_buffer_missing");
        }
        std::size_t packedSize = 0;
        if (LiteRtGetTensorBufferPackedSize(handle->buffer, &packedSize) != kLiteRtStatusOk) {
            return core::fail(core::FailureCode::NativeRuntime, "output_packed_size_unavailable");
        }
        const std::size_t count = packedSize / sizeof(float);
        runtime->outputScratch.assign(count, 0.0F);
        void* address = nullptr;
        if (LiteRtLockTensorBuffer(handle->buffer, &address, kLiteRtTensorBufferLockModeRead) != kLiteRtStatusOk || address == nullptr) {
            return core::fail(core::FailureCode::NativeRuntime, "output_lock_failed");
        }
        std::memcpy(runtime->outputScratch.data(), address, count * sizeof(float));
        LiteRtUnlockTensorBuffer(handle->buffer);
        return std::span<const float>(runtime->outputScratch);
    }

private:
    core::Result<void> buildRuntime(const std::string& key, LiteRtSignature signature, LiteRtParamIndex index) {
        SignatureRuntime runtime;
        runtime.signature = signature;
        runtime.index = index;
        LiteRtParamIndex numInputs = 0;
        if (LiteRtGetNumSignatureInputs(signature, &numInputs) != kLiteRtStatusOk) {
            return core::fail(core::FailureCode::NativeRuntime, "signature_input_count_failed");
        }
        for (LiteRtParamIndex input = 0; input < numInputs; ++input) {
            const char* name = nullptr;
            if (LiteRtGetSignatureInputName(signature, input, &name) != kLiteRtStatusOk || name == nullptr) {
                return core::fail(core::FailureCode::NativeRuntime, "signature_input_name_failed");
            }
            LiteRtTensorBufferRequirements requirements = nullptr;
            if (LiteRtGetCompiledModelInputBufferRequirements(compiledModel_, index, input, &requirements) != kLiteRtStatusOk) {
                return core::fail(core::FailureCode::NativeRuntime, "input_requirements_failed");
            }
            LiteRtTensor tensor = nullptr;
            if (LiteRtGetSignatureInputTensorByIndex(signature, input, &tensor) != kLiteRtStatusOk) {
                return core::fail(core::FailureCode::NativeRuntime, "input_tensor_failed");
            }
            LiteRtRankedTensorType tensorType{};
            if (LiteRtGetRankedTensorType(tensor, &tensorType) != kLiteRtStatusOk) {
                return core::fail(core::FailureCode::NativeRuntime, "input_tensor_type_failed");
            }
            LiteRtTensorBuffer buffer = nullptr;
            if (LiteRtCreateManagedTensorBufferFromRequirements(environment_, &tensorType, requirements, &buffer) != kLiteRtStatusOk) {
                return core::fail(core::FailureCode::NativeRuntime, "input_buffer_create_failed");
            }
            runtime.inputs.push_back(TensorHandle{buffer, std::string(name)});
            runtime.inputHandles.push_back(buffer);
        }
        LiteRtParamIndex numOutputs = 0;
        if (LiteRtGetNumSignatureOutputs(signature, &numOutputs) != kLiteRtStatusOk) {
            return core::fail(core::FailureCode::NativeRuntime, "signature_output_count_failed");
        }
        for (LiteRtParamIndex output = 0; output < numOutputs; ++output) {
            const char* name = nullptr;
            if (LiteRtGetSignatureOutputName(signature, output, &name) != kLiteRtStatusOk || name == nullptr) {
                return core::fail(core::FailureCode::NativeRuntime, "signature_output_name_failed");
            }
            LiteRtTensorBufferRequirements requirements = nullptr;
            if (LiteRtGetCompiledModelOutputBufferRequirements(compiledModel_, index, output, &requirements) != kLiteRtStatusOk) {
                return core::fail(core::FailureCode::NativeRuntime, "output_requirements_failed");
            }
            LiteRtTensor tensor = nullptr;
            if (LiteRtGetSignatureOutputTensorByIndex(signature, output, &tensor) != kLiteRtStatusOk) {
                return core::fail(core::FailureCode::NativeRuntime, "output_tensor_failed");
            }
            LiteRtRankedTensorType tensorType{};
            if (LiteRtGetRankedTensorType(tensor, &tensorType) != kLiteRtStatusOk) {
                return core::fail(core::FailureCode::NativeRuntime, "output_tensor_type_failed");
            }
            LiteRtTensorBuffer buffer = nullptr;
            if (LiteRtCreateManagedTensorBufferFromRequirements(environment_, &tensorType, requirements, &buffer) != kLiteRtStatusOk) {
                return core::fail(core::FailureCode::NativeRuntime, "output_buffer_create_failed");
            }
            runtime.outputs.push_back(TensorHandle{buffer, std::string(name)});
            runtime.outputHandles.push_back(buffer);
        }
        runtimes_.emplace(key, std::move(runtime));
        return {};
    }

    [[nodiscard]] const SignatureRuntime* findRuntime(std::string_view signature) const {
        const auto match = runtimes_.find(signature);
        return match == runtimes_.end() ? nullptr : &match->second;
    }

    [[nodiscard]] SignatureRuntime* findRuntime(std::string_view signature) {
        const auto match = runtimes_.find(signature);
        return match == runtimes_.end() ? nullptr : &match->second;
    }

    [[nodiscard]] static const TensorHandle* findTensor(const std::vector<TensorHandle>& handles, std::string_view name) {
        const auto match = std::ranges::find(handles, name, &TensorHandle::name);
        return match == handles.end() ? nullptr : &*match;
    }

    [[nodiscard]] core::Result<void> tensorType(std::string_view signature, std::string_view tensor, bool input, LiteRtRankedTensorType& out) const {
        const SignatureRuntime* runtime = findRuntime(signature);
        if (runtime == nullptr) {
            return core::fail(core::FailureCode::NativeRuntime, "unknown_signature");
        }
        const std::vector<TensorHandle>& handles = input ? runtime->inputs : runtime->outputs;
        LiteRtParamIndex indexInSignature = 0;
        bool found = false;
        for (std::size_t position = 0; position < handles.size(); ++position) {
            if (handles[position].name == tensor) {
                indexInSignature = static_cast<LiteRtParamIndex>(position);
                found = true;
                break;
            }
        }
        if (!found) {
            return core::fail(core::FailureCode::NativeRuntime, "tensor_not_found");
        }
        LiteRtTensor litertTensor = nullptr;
        const LiteRtStatus status = input
            ? LiteRtGetSignatureInputTensorByIndex(runtime->signature, indexInSignature, &litertTensor)
            : LiteRtGetSignatureOutputTensorByIndex(runtime->signature, indexInSignature, &litertTensor);
        if (status != kLiteRtStatusOk) {
            return core::fail(core::FailureCode::NativeRuntime, "tensor_lookup_failed");
        }
        if (LiteRtGetRankedTensorType(litertTensor, &out) != kLiteRtStatusOk) {
            return core::fail(core::FailureCode::NativeRuntime, "tensor_type_failed");
        }
        return {};
    }

    [[nodiscard]] core::Result<void> inputTensorType(std::string_view signature, std::string_view tensor, LiteRtRankedTensorType& out) const {
        return tensorType(signature, tensor, true, out);
    }

    [[nodiscard]] core::Result<void> outputTensorType(std::string_view signature, std::string_view tensor, LiteRtRankedTensorType& out) const {
        return tensorType(signature, tensor, false, out);
    }

    core::Result<void> writeInput(std::string_view signature, std::string_view tensor, std::span<const std::byte> bytes) {
        SignatureRuntime* runtime = findRuntime(signature);
        if (runtime == nullptr) {
            return core::fail(core::FailureCode::NativeRuntime, "unknown_signature");
        }
        const TensorHandle* handle = findTensor(runtime->inputs, tensor);
        if (handle == nullptr) {
            return core::fail(core::FailureCode::NativeRuntime, "input_buffer_missing");
        }
        std::size_t packedSize = 0;
        if (LiteRtGetTensorBufferPackedSize(handle->buffer, &packedSize) != kLiteRtStatusOk) {
            return core::fail(core::FailureCode::NativeRuntime, "input_packed_size_unavailable");
        }
        void* address = nullptr;
        if (LiteRtLockTensorBuffer(handle->buffer, &address, kLiteRtTensorBufferLockModeWrite) != kLiteRtStatusOk || address == nullptr) {
            return core::fail(core::FailureCode::NativeRuntime, "input_lock_failed");
        }
        const std::size_t copyBytes = std::min(packedSize, bytes.size());
        std::memcpy(address, bytes.data(), copyBytes);
        if (copyBytes < packedSize) {
            std::memset(static_cast<std::byte*>(address) + copyBytes, 0, packedSize - copyBytes);
        }
        LiteRtUnlockTensorBuffer(handle->buffer);
        return {};
    }

    LiteRtEnvironment environment_;
    LiteRtModel model_;
    LiteRtOptions options_;
    LiteRtCompiledModel compiledModel_;
    std::vector<std::string> signatureKeys_;
    std::map<std::string, SignatureRuntime, std::less<>> runtimes_;
};

}

core::Result<std::unique_ptr<CompiledGraph>> createLiteRtCompiledGraph(format::ByteSpan tfliteModel, const CompiledGraphOptions& options) {
    LiteRtEnvironment environment = nullptr;
    if (LiteRtCreateEnvironment(0, nullptr, &environment) != kLiteRtStatusOk) {
        return core::fail(core::FailureCode::NativeRuntime, "litert_environment_create_failed");
    }
    LiteRtModel model = nullptr;
    if (LiteRtCreateModelFromBuffer(environment, tfliteModel.data(), tfliteModel.size(), &model) != kLiteRtStatusOk) {
        LiteRtDestroyEnvironment(environment);
        return core::fail(core::FailureCode::InvalidModelFile, "litert_model_create_failed");
    }
    LiteRtOptions compilationOptions = nullptr;
    if (LiteRtCreateOptions(&compilationOptions) != kLiteRtStatusOk) {
        LiteRtDestroyModel(model);
        LiteRtDestroyEnvironment(environment);
        return core::fail(core::FailureCode::NativeRuntime, "litert_options_create_failed");
    }
    const LiteRtHwAcceleratorSet accelerators = options.backend == ComputeBackend::Gpu
        ? static_cast<LiteRtHwAcceleratorSet>(kLiteRtHwAcceleratorGpu)
        : static_cast<LiteRtHwAcceleratorSet>(kLiteRtHwAcceleratorCpu);
    LiteRtSetOptionsHardwareAccelerators(compilationOptions, accelerators);
    LiteRtCompiledModel compiledModel = nullptr;
    LiteRtStatus compileStatus = LiteRtCreateCompiledModel(environment, model, compilationOptions, &compiledModel);
    if (compileStatus != kLiteRtStatusOk && options.backend == ComputeBackend::Gpu) {
        LiteRtSetOptionsHardwareAccelerators(compilationOptions, static_cast<LiteRtHwAcceleratorSet>(kLiteRtHwAcceleratorCpu));
        compileStatus = LiteRtCreateCompiledModel(environment, model, compilationOptions, &compiledModel);
    }
    if (compileStatus != kLiteRtStatusOk) {
        LiteRtDestroyOptions(compilationOptions);
        LiteRtDestroyModel(model);
        LiteRtDestroyEnvironment(environment);
        return core::fail(core::FailureCode::NativeRuntime, "litert_compiled_model_create_failed");
    }
    auto graph = std::make_unique<LiteRtCompiledGraph>(environment, model, compilationOptions, compiledModel);
    if (auto initialized = graph->initialize(); !initialized) {
        return std::unexpected(initialized.error());
    }
    return graph;
}

}
