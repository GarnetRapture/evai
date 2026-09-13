#include "pc_runtime/text_resource_manager.h"

#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "absl/status/status.h"
#include "absl/status/status_macros.h"
#include "absl/status/statusor.h"
#include "absl/strings/string_view.h"
#include "absl/synchronization/mutex.h"
#include "absl/types/span.h"
#include "litert/cc/litert_macros.h"
#include "litert/cc/litert_tensor_buffer.h"
#include "runtime/engine/io_types.h"
#include "runtime/executor/executor_settings_base.h"
#include "runtime/executor/llm_executor.h"
#include "runtime/executor/llm_executor_io_types.h"
#include "runtime/executor/llm_executor_processed_tokens.h"
#include "runtime/executor/llm_executor_settings.h"
#include "runtime/framework/resource_management/context_handler/context_handler.h"
#include "runtime/framework/resource_management/utils/movable_mutex_lock.h"
#include "runtime/framework/resource_management/utils/resource_manager_utils.h"
#include "runtime/util/convert_tensor_buffer.h"
#include "runtime/util/status_macros.h"

namespace eversoul::pc_runtime {
namespace {

using litert::lm::ContextHandler;
using litert::lm::ExecutorDecodeParams;
using litert::lm::ExecutorInputs;
using litert::lm::ExecutorPrefillParams;
using litert::lm::ExecutorTextData;
using litert::lm::LlmContext;
using litert::lm::LlmExecutor;
using litert::lm::LlmExecutorSettings;
using litert::lm::MovableMutexLock;
using litert::lm::ProcessedTokens;
using litert::lm::RuntimeConfig;
using litert::lm::RuntimeState;

absl::Status RejectMultimodalInputs(const ExecutorInputs& inputs) {
    if (inputs.GetVisionDataPtr().ok() || inputs.GetAudioDataPtr().ok()) {
        return absl::InvalidArgumentError("pc_text_runtime_rejects_multimodal_input");
    }
    return absl::OkStatus();
}

absl::Status SaveProcessedContextAndSeparateLoadedHandler(
    std::shared_ptr<ContextHandler> contextHandler,
    std::shared_ptr<LlmExecutor> llmExecutor) {
    RET_CHECK_EQ(
        contextHandler->HasRuntimeConfig() || contextHandler->HasRuntimeState()
            || contextHandler->shared_processed_context()->HasProcessedContext(),
        false);
    ABSL_ASSIGN_OR_RETURN(auto llmContext, llmExecutor->CloneContext());
    ABSL_ASSIGN_OR_RETURN(auto processedContext, llmContext->RetrieveProcessedContext());
    ABSL_RETURN_IF_ERROR(
        contextHandler->shared_processed_context()->SetProcessedContext(std::move(processedContext)));
    auto separatedContext = std::make_shared<ContextHandler::SharedProcessedContext>(nullptr);
    return contextHandler->UpdateSharedProcessedContext(std::move(separatedContext));
}

class LockedTextLlmExecutor final : public LlmExecutor {
public:
    LockedTextLlmExecutor(
        std::shared_ptr<LlmExecutor> executor,
        MovableMutexLock lock,
        std::shared_ptr<ContextHandler> currentHandler = nullptr)
        : currentHandler_(std::move(currentHandler)),
          executor_(std::move(executor)),
          lock_(std::move(lock)) {}

    absl::string_view ExecutorBackendName() const override {
        return executor_->ExecutorBackendName();
    }

    absl::Status Prefill(const ExecutorInputs& inputs) override {
        return Prefill(inputs, ExecutorPrefillParams());
    }

    absl::Status Prefill(const ExecutorInputs& inputs, const ExecutorPrefillParams& prefillParams) override {
        ABSL_RETURN_IF_ERROR(RejectMultimodalInputs(inputs));
        if (currentHandler_ == nullptr) {
            return executor_->Prefill(inputs, prefillParams);
        }
        ABSL_ASSIGN_OR_RETURN(auto tokenIds, inputs.GetTextTokenIdsPtr());
        LITERT_ASSIGN_OR_RETURN(auto tokenIdsType, tokenIds->TensorType());
        RET_CHECK_EQ(tokenIdsType.Layout().Dimensions()[0], 1);
        if (tokenIdsType.Layout().Dimensions()[1] == 0) {
            return absl::OkStatus();
        }
        ABSL_ASSIGN_OR_RETURN(int currentStep, executor_->GetCurrentStep());
        if (prefillParams.GetCurrentStep() != -1) {
            currentStep = prefillParams.GetCurrentStep();
        }
        ABSL_ASSIGN_OR_RETURN(const ProcessedTokens* processedTokens, executor_->GetProcessedTokens());
        if (processedTokens->TokenCount() == currentStep) {
            return executor_->Prefill(inputs, prefillParams);
        }
        LITERT_ASSIGN_OR_RETURN(
            auto inputIds, litert::lm::CopyFromTensorBuffer<int32_t>(*(*inputs.GetTextTokenIdsPtr())));
        bool usesRingBuffers = false;
        auto executorSettings = executor_->GetExecutorSettings();
        if (executorSettings.ok() && executorSettings->GetBackend() == litert::lm::Backend::GPU_ARTISAN) {
            LITERT_ASSIGN_OR_RETURN(
                litert::lm::GpuArtisanConfig artisanConfig,
                executorSettings->GetBackendConfig<litert::lm::GpuArtisanConfig>());
            usesRingBuffers = artisanConfig.use_autosized_ringbuffers;
        }
        if (!usesRingBuffers) {
            ABSL_RETURN_IF_ERROR(litert::lm::RemoveMatchingTokens(
                processedTokens->GetCopyOfTokens()[0], &inputIds, &currentStep));
        }
        if (inputIds.empty()) {
            return executor_->SetCurrentStep(currentStep);
        }
        LITERT_ASSIGN_OR_RETURN(
            auto remainingTokenIds,
            litert::lm::CopyToTensorBuffer(
                absl::MakeConstSpan(inputIds.data(), inputIds.size()),
                {1, static_cast<int>(inputIds.size())}));
        const ExecutorInputs remainingInputs(
            ExecutorTextData(std::move(remainingTokenIds)), std::nullopt, std::nullopt);
        auto remainingParams = prefillParams;
        remainingParams.SetCurrentStep(currentStep);
        if (processedTokens->TokenCount() == currentStep) {
            return executor_->Prefill(remainingInputs, remainingParams);
        }
        ABSL_ASSIGN_OR_RETURN(
            int longestStep, currentHandler_->shared_processed_context()->LongestHandlerTimeStep(*executor_));
        if (longestStep != currentStep) {
            ABSL_RETURN_IF_ERROR(SaveProcessedContextAndSeparateLoadedHandler(currentHandler_, executor_));
        }
        ABSL_RETURN_IF_ERROR(executor_->SetCurrentStep(currentStep));
        return executor_->Prefill(remainingInputs, remainingParams);
    }

    absl::StatusOr<std::vector<std::vector<int>>> Decode() override {
        return Decode(ExecutorDecodeParams());
    }

    absl::StatusOr<std::vector<std::vector<int>>> Decode(const ExecutorDecodeParams& decodeParams) override {
        ABSL_RETURN_IF_ERROR(TruncateProcessedTokensForHandler());
        return executor_->Decode(decodeParams);
    }

    absl::Status Decode(const ExecutorInputs& inputs, litert::TensorBuffer& outputLogits) override {
        ABSL_RETURN_IF_ERROR(RejectMultimodalInputs(inputs));
        ABSL_RETURN_IF_ERROR(TruncateProcessedTokensForHandler());
        ABSL_ASSIGN_OR_RETURN(outputLogits, executor_->DecodeLogits(inputs));
        return absl::OkStatus();
    }

    absl::StatusOr<litert::TensorBuffer> DecodeLogits(const ExecutorInputs& inputs) override {
        ABSL_RETURN_IF_ERROR(RejectMultimodalInputs(inputs));
        ABSL_ASSIGN_OR_RETURN(int currentStep, executor_->GetCurrentStep());
        ABSL_ASSIGN_OR_RETURN(const ProcessedTokens* processedTokens, executor_->GetProcessedTokens());
        if (currentStep == processedTokens->TokenCount()
            && !processedTokens->GetNextUnprocessedToken().token.empty()) {
            ABSL_RETURN_IF_ERROR(executor_->SetCurrentStep(currentStep - 1));
        }
        ABSL_RETURN_IF_ERROR(TruncateProcessedTokensForHandler());
        return executor_->DecodeLogits(inputs);
    }

    absl::StatusOr<std::unique_ptr<LlmContext>> CloneContext() const override {
        return executor_->CloneContext();
    }

    absl::Status RestoreContext(std::unique_ptr<LlmContext> llmContext) override {
        return executor_->RestoreContext(std::move(llmContext));
    }

    absl::Status UpdateRuntimeConfig(const RuntimeConfig& runtimeConfig) override {
        return executor_->UpdateRuntimeConfig(runtimeConfig);
    }

    absl::StatusOr<RuntimeConfig> GetRuntimeConfig() const override {
        return executor_->GetRuntimeConfig();
    }

    absl::Status UpdateRuntimeState(const RuntimeState& runtimeState) override {
        return executor_->UpdateRuntimeState(runtimeState);
    }

    absl::StatusOr<RuntimeState> GetRuntimeState() const override {
        return executor_->GetRuntimeState();
    }

    absl::StatusOr<LlmExecutorSettings> GetExecutorSettings() const override {
        return executor_->GetExecutorSettings();
    }

    absl::Status UpdateExecutorSettings(const LlmExecutorSettings& executorSettings) override {
        return executor_->UpdateExecutorSettings(executorSettings);
    }

    absl::StatusOr<int> GetCurrentStep() const override {
        return executor_->GetCurrentStep();
    }

    absl::Status SetCurrentStep(int step) override {
        return executor_->SetCurrentStep(step);
    }

    absl::StatusOr<const ProcessedTokens*> GetProcessedTokens() const override {
        return executor_->GetProcessedTokens();
    }

    absl::StatusOr<std::string> GetProfileSummary() override {
        return executor_->GetProfileSummary();
    }

    absl::Status Reset() override {
        return executor_->Reset();
    }

    absl::StatusOr<int> GetVocabSize() override {
        return executor_->GetVocabSize();
    }

private:
    absl::Status TruncateProcessedTokensForHandler() {
        if (currentHandler_ == nullptr) {
            return absl::OkStatus();
        }
        ABSL_ASSIGN_OR_RETURN(int currentStep, executor_->GetCurrentStep());
        ABSL_ASSIGN_OR_RETURN(const ProcessedTokens* processedTokens, executor_->GetProcessedTokens());
        if (processedTokens->TokenCount() == currentStep) {
            return absl::OkStatus();
        }
        ABSL_ASSIGN_OR_RETURN(
            int longestStep, currentHandler_->shared_processed_context()->LongestHandlerTimeStep(*executor_));
        if (longestStep != currentStep) {
            ABSL_RETURN_IF_ERROR(SaveProcessedContextAndSeparateLoadedHandler(currentHandler_, executor_));
        }
        return executor_->SetCurrentStep(currentStep);
    }

    std::shared_ptr<ContextHandler> currentHandler_;
    std::shared_ptr<LlmExecutor> executor_;
    MovableMutexLock lock_;
};

}

TextResourceManager::TextResourceManager(std::unique_ptr<LlmExecutor> llmExecutor)
    : llmExecutor_(std::move(llmExecutor)) {}

TextResourceManager::~TextResourceManager() {
    absl::MutexLock lock(executorMutex_);
    currentHandler_.reset();
    llmExecutor_.reset();
}

absl::StatusOr<std::unique_ptr<TextResourceManager>> TextResourceManager::Create(
    std::unique_ptr<LlmExecutor> llmExecutor) {
    if (llmExecutor == nullptr) {
        return absl::InvalidArgumentError("pc_text_runtime_missing_llm_executor");
    }
    return std::unique_ptr<TextResourceManager>(new TextResourceManager(std::move(llmExecutor)));
}

absl::StatusOr<std::unique_ptr<ContextHandler>> TextResourceManager::CreateContextHandler(
    const litert::lm::SessionConfig& sessionConfig) {
    if (sessionConfig.GetScopedLoraFile() != nullptr || sessionConfig.GetAudioScopedLoraFile() != nullptr) {
        return absl::InvalidArgumentError("pc_text_runtime_rejects_lora");
    }
    if (sessionConfig.AudioModalityEnabled() || sessionConfig.VisionModalityEnabled()) {
        return absl::InvalidArgumentError("pc_text_runtime_rejects_multimodal_session");
    }
    RuntimeConfig runtimeConfig{
        .sampler_params = sessionConfig.GetSamplerParams(),
        .output_heads = sessionConfig.GetNumOutputCandidates(),
        .tokens_per_decode = 1,
    };
    std::unique_ptr<LlmContext> llmContext;
    {
        MovableMutexLock lock(&executorMutex_);
        ABSL_ASSIGN_OR_RETURN(llmContext, llmExecutor_->CreateNewContext(std::nullopt, std::move(runtimeConfig)));
    }
    return ContextHandler::Create(std::move(llmContext));
}

absl::StatusOr<std::unique_ptr<ContextHandler>> TextResourceManager::CloneContextHandler(
    std::shared_ptr<const ContextHandler> contextHandler) {
    RET_CHECK_NE(contextHandler, nullptr);
    RuntimeConfig runtimeConfig;
    RuntimeState runtimeState;
    if (contextHandler->HasRuntimeConfig() && contextHandler->HasRuntimeState()) {
        ABSL_ASSIGN_OR_RETURN(runtimeConfig, contextHandler->GetRuntimeConfig());
        ABSL_ASSIGN_OR_RETURN(runtimeState, contextHandler->GetRuntimeState());
    }
    else {
        MovableMutexLock lock(&executorMutex_);
        RET_CHECK_EQ(currentHandler_, contextHandler);
        ABSL_ASSIGN_OR_RETURN(runtimeConfig, llmExecutor_->GetRuntimeConfig());
        ABSL_ASSIGN_OR_RETURN(runtimeState, llmExecutor_->GetRuntimeState());
    }
    return ContextHandler::Bundle(
        contextHandler->shared_processed_context(),
        std::make_unique<RuntimeConfig>(runtimeConfig),
        std::make_unique<RuntimeState>(runtimeState));
}

absl::StatusOr<std::unique_ptr<LlmExecutor>> TextResourceManager::AcquireExecutor() {
    MovableMutexLock lock(&executorMutex_);
    if (llmExecutor_ == nullptr) {
        return absl::FailedPreconditionError("pc_text_runtime_llm_executor_released");
    }
    return std::make_unique<LockedTextLlmExecutor>(llmExecutor_, std::move(lock));
}

absl::StatusOr<std::unique_ptr<LlmExecutor>> TextResourceManager::AcquireExecutorWithContextHandler(
    std::shared_ptr<ContextHandler> contextHandler) {
    RET_CHECK_NE(contextHandler, nullptr);
    MovableMutexLock lock(&executorMutex_);
    if (llmExecutor_ == nullptr) {
        return absl::FailedPreconditionError("pc_text_runtime_llm_executor_released");
    }
    if (contextHandler == currentHandler_) {
        return std::make_unique<LockedTextLlmExecutor>(llmExecutor_, std::move(lock), currentHandler_);
    }
    if (currentHandler_ != nullptr
        && contextHandler->shared_processed_context() == currentHandler_->shared_processed_context()) {
        ABSL_ASSIGN_OR_RETURN(auto currentRuntimeConfig, llmExecutor_->GetRuntimeConfig());
        ABSL_ASSIGN_OR_RETURN(auto currentRuntimeState, llmExecutor_->GetRuntimeState());
        ABSL_RETURN_IF_ERROR(currentHandler_->SetRuntimeConfig(std::make_unique<RuntimeConfig>(currentRuntimeConfig)));
        ABSL_RETURN_IF_ERROR(currentHandler_->SetRuntimeState(std::make_unique<RuntimeState>(currentRuntimeState)));
        ABSL_ASSIGN_OR_RETURN(auto nextRuntimeConfig, contextHandler->RetrieveRuntimeConfig());
        ABSL_ASSIGN_OR_RETURN(auto nextRuntimeState, contextHandler->RetrieveRuntimeState());
        ABSL_RETURN_IF_ERROR(llmExecutor_->UpdateRuntimeConfig(*nextRuntimeConfig));
        ABSL_RETURN_IF_ERROR(llmExecutor_->UpdateRuntimeState(*nextRuntimeState));
    }
    else {
        if (currentHandler_ != nullptr) {
            ABSL_ASSIGN_OR_RETURN(auto currentContext, llmExecutor_->CloneContext());
            ABSL_ASSIGN_OR_RETURN(auto currentRuntimeConfig, currentContext->RetrieveRuntimeConfig());
            ABSL_ASSIGN_OR_RETURN(auto currentRuntimeState, currentContext->RetrieveRuntimeState());
            ABSL_ASSIGN_OR_RETURN(auto currentProcessedContext, currentContext->RetrieveProcessedContext());
            ABSL_RETURN_IF_ERROR(currentHandler_->SetRuntimeConfig(std::move(currentRuntimeConfig)));
            ABSL_RETURN_IF_ERROR(currentHandler_->SetRuntimeState(std::move(currentRuntimeState)));
            ABSL_RETURN_IF_ERROR(
                currentHandler_->shared_processed_context()->SetProcessedContext(std::move(currentProcessedContext)));
        }
        ABSL_ASSIGN_OR_RETURN(auto nextRuntimeConfig, contextHandler->RetrieveRuntimeConfig());
        ABSL_ASSIGN_OR_RETURN(auto nextRuntimeState, contextHandler->RetrieveRuntimeState());
        ABSL_ASSIGN_OR_RETURN(
            auto nextProcessedContext, contextHandler->shared_processed_context()->RetrieveProcessedContext());
        auto nextContext = std::make_unique<LlmContext>(
            std::move(nextProcessedContext), std::move(nextRuntimeConfig), std::move(nextRuntimeState));
        ABSL_RETURN_IF_ERROR(llmExecutor_->RestoreContext(std::move(nextContext)));
    }
    currentHandler_ = std::move(contextHandler);
    return std::make_unique<LockedTextLlmExecutor>(llmExecutor_, std::move(lock), currentHandler_);
}

void TextResourceManager::ResetCurrentHandler() {
    absl::MutexLock lock(executorMutex_);
    if (llmExecutor_ != nullptr) {
        llmExecutor_->Reset().IgnoreError();
    }
    currentHandler_ = nullptr;
}

absl::Status TextResourceManager::UpdateExecutorSettings(const LlmExecutorSettings& executorSettings) {
    ABSL_ASSIGN_OR_RETURN(auto executor, AcquireExecutor());
    return executor->UpdateExecutorSettings(executorSettings);
}

}
