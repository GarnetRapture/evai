#include <atomic>
#include <future>
#include <memory>
#include <optional>
#include <utility>

#include "absl/log/absl_log.h"
#include "absl/status/status.h"
#include "absl/status/status_macros.h"
#include "absl/status/statusor.h"
#include "absl/strings/string_view.h"
#include "absl/time/clock.h"
#include "absl/time/time.h"
#include "pc_runtime/text_execution_manager.h"
#include "runtime/components/model_resources.h"
#include "runtime/core/session_advanced.h"
#include "runtime/engine/engine.h"
#include "runtime/engine/engine_factory.h"
#include "runtime/engine/engine_settings.h"
#include "runtime/engine/io_types.h"
#include "runtime/executor/executor_settings_base.h"
#include "runtime/executor/litert_compiled_model_executor_utils.h"
#include "runtime/executor/llm_executor.h"
#include "runtime/executor/llm_executor_settings.h"
#include "runtime/executor/llm_litert_compiled_model_executor_factory.h"
#include "runtime/proto/llm_metadata.pb.h"
#include "runtime/util/litert_util.h"
#include "support/tokenizer/tokenizer.h"

namespace eversoul::pc_runtime {
namespace {

using litert::lm::BenchmarkInfo;
using litert::lm::Engine;
using litert::lm::EngineSettings;
using litert::lm::ModelResources;
using litert::lm::ModelType;
using litert::lm::OwnedEnvironment;
using litert::lm::SessionAdvanced;
using litert::lm::SessionConfig;
using litert::support::Tokenizer;

absl::Status ValidateTextEngineSettings(const EngineSettings& settings) {
    if (settings.GetVisionExecutorSettings().has_value() || settings.GetAudioExecutorSettings().has_value()) {
        return absl::InvalidArgumentError("pc_text_runtime_rejects_multimodal_engine");
    }
    if (settings.GetSingleThreadedExecution()) {
        return absl::InvalidArgumentError("pc_text_runtime_requires_threaded_execution");
    }
    const auto backend = settings.GetMainExecutorSettings().GetBackend();
    if (backend != litert::lm::Backend::CPU && backend != litert::lm::Backend::GPU) {
        return absl::InvalidArgumentError("pc_text_runtime_supports_cpu_and_gpu_backends");
    }
    return absl::OkStatus();
}

absl::Status UpdateTextSettings(
    EngineSettings& settings,
    Tokenizer* tokenizer,
    const litert::lm::proto::LlmMetadata* metadata,
    absl::string_view promptHint,
    ModelResources& resources) {
    return settings.MaybeUpdateAndValidate(
        tokenizer,
        metadata,
        promptHint,
        resources.GetTFLiteModelBackendConstraint(ModelType::kTfLitePrefillDecode),
        std::nullopt,
        std::nullopt,
        resources.GetTFLiteModelPreferActivationType(ModelType::kTfLitePrefillDecode),
        std::nullopt,
        std::nullopt);
}

class TextEngine final : public Engine {
public:
    TextEngine(
        EngineSettings settings,
        std::unique_ptr<ModelResources> resources,
        std::unique_ptr<OwnedEnvironment> environment,
        std::unique_ptr<Tokenizer> tokenizer,
        std::shared_ptr<TextExecutionManager> executionManager,
        std::optional<BenchmarkInfo> benchmarkInfo)
        : settings_(std::move(settings)),
          resources_(std::move(resources)),
          environment_(std::move(environment)),
          tokenizer_(std::move(tokenizer)),
          executionManager_(std::move(executionManager)),
          benchmarkInfo_(std::move(benchmarkInfo)) {}

    ~TextEngine() override {
        const absl::Status status = WaitUntilDone(Engine::kDefaultTimeout);
        if (!status.ok()) {
            ABSL_LOG(ERROR) << "pc_text_runtime_engine_wait_failed: " << status;
        }
        if (livingSessions_.load() > 0) {
            ABSL_LOG(ERROR) << "pc_text_runtime_engine_destroyed_with_sessions: " << livingSessions_.load();
        }
        executionManager_.reset();
        environment_.reset();
        tokenizer_.reset();
        resources_.reset();
    }

    absl::StatusOr<std::unique_ptr<litert::lm::SessionInterface>> CreateSession(
        const SessionConfig& sessionConfig) override {
        if (sessionConfig.AudioModalityEnabled() || sessionConfig.VisionModalityEnabled()) {
            return absl::InvalidArgumentError("pc_text_runtime_rejects_multimodal_session");
        }
        std::optional<BenchmarkInfo> sessionBenchmark;
        if (benchmarkInfo_.has_value()) {
            sessionBenchmark = benchmarkInfo_;
            ABSL_RETURN_IF_ERROR(sessionBenchmark->TimeInitPhaseStart(BenchmarkInfo::InitPhase::kSession));
        }
        SessionConfig config = sessionConfig;
        ABSL_RETURN_IF_ERROR(config.MaybeUpdateAndValidate(settings_));
        ABSL_ASSIGN_OR_RETURN(
            std::unique_ptr<SessionAdvanced> session,
            SessionAdvanced::Create(
                executionManager_, tokenizer_.get(), config, std::move(sessionBenchmark), &livingSessions_));
        if (benchmarkInfo_.has_value()) {
            auto mutableBenchmark = session->GetMutableBenchmarkInfo();
            if (mutableBenchmark.ok()) {
                ABSL_RETURN_IF_ERROR(
                    mutableBenchmark.value()->TimeInitPhaseEnd(BenchmarkInfo::InitPhase::kSession));
            }
        }
        return session;
    }

    absl::Status WaitUntilDone(absl::Duration timeout) override {
        return executionManager_ == nullptr ? absl::OkStatus() : executionManager_->WaitUntilAllDone(timeout);
    }

    const EngineSettings& GetEngineSettings() const override {
        return settings_;
    }

    const Tokenizer& GetTokenizer() const override {
        return *tokenizer_;
    }

    absl::StatusOr<litert::lm::AudioExecutorProperties> GetAudioExecutorProperties() const override {
        return absl::UnimplementedError("pc_text_runtime_has_no_audio_executor");
    }

    absl::StatusOr<litert::lm::VisionExecutorProperties> GetVisionExecutorProperties() const override {
        return absl::UnimplementedError("pc_text_runtime_has_no_vision_executor");
    }

private:
    EngineSettings settings_;
    std::unique_ptr<ModelResources> resources_;
    std::unique_ptr<OwnedEnvironment> environment_;
    std::unique_ptr<Tokenizer> tokenizer_;
    std::shared_ptr<TextExecutionManager> executionManager_;
    std::atomic<int> livingSessions_{0};
    std::optional<BenchmarkInfo> benchmarkInfo_;
};

absl::StatusOr<std::unique_ptr<Engine>> CreateTextEngine(EngineSettings settings, absl::string_view promptHint) {
    ABSL_RETURN_IF_ERROR(ValidateTextEngineSettings(settings));
    std::optional<BenchmarkInfo> benchmarkInfo = settings.IsBenchmarkEnabled()
        ? std::make_optional<BenchmarkInfo>(settings.GetBenchmarkParams().value())
        : std::nullopt;
    if (benchmarkInfo.has_value()) {
        ABSL_RETURN_IF_ERROR(benchmarkInfo->TimeInitPhaseStart(BenchmarkInfo::InitPhase::kTotal));
        ABSL_RETURN_IF_ERROR(benchmarkInfo->TimeInitPhaseStart(BenchmarkInfo::InitPhase::kModelAssets));
    }
    const auto& modelAssets = settings.GetMutableMainExecutorSettings().GetModelAssets();
    ABSL_ASSIGN_OR_RETURN(std::unique_ptr<ModelResources> resources,
        litert::lm::BuildLiteRtCompiledModelResources(modelAssets, false, false));
    if (benchmarkInfo.has_value()) {
        ABSL_RETURN_IF_ERROR(benchmarkInfo->TimeInitPhaseEnd(BenchmarkInfo::InitPhase::kModelAssets));
        ABSL_RETURN_IF_ERROR(benchmarkInfo->TimeInitPhaseStart(BenchmarkInfo::InitPhase::kLlmMetadata));
    }
    ABSL_ASSIGN_OR_RETURN(const auto* metadata, resources->GetLlmMetadata());
    if (benchmarkInfo.has_value()) {
        ABSL_RETURN_IF_ERROR(benchmarkInfo->TimeInitPhaseEnd(BenchmarkInfo::InitPhase::kLlmMetadata));
    }
    const bool hasModelType = metadata != nullptr && metadata->has_llm_model_type();
    absl::Duration tokenizerDuration = absl::ZeroDuration();
    auto createTokenizer = [&tokenizerDuration, &resources]() -> absl::StatusOr<std::unique_ptr<Tokenizer>> {
        const absl::Time start = absl::Now();
        ABSL_ASSIGN_OR_RETURN(std::unique_ptr<Tokenizer> tokenizer, resources->GetTokenizer());
        tokenizerDuration = absl::Now() - start;
        return tokenizer;
    };
    std::future<absl::StatusOr<std::unique_ptr<Tokenizer>>> tokenizerFuture;
    std::unique_ptr<Tokenizer> tokenizer;
    if (!hasModelType) {
        ABSL_ASSIGN_OR_RETURN(tokenizer, createTokenizer());
        ABSL_RETURN_IF_ERROR(UpdateTextSettings(settings, tokenizer.get(), metadata, promptHint, *resources));
    }
    else {
        tokenizerFuture = std::async(
            settings.GetParallelFileSectionLoading() ? std::launch::async : std::launch::deferred, createTokenizer);
        ABSL_RETURN_IF_ERROR(UpdateTextSettings(settings, nullptr, metadata, promptHint, *resources));
    }
    if (benchmarkInfo.has_value()) {
        ABSL_RETURN_IF_ERROR(benchmarkInfo->TimeInitPhaseStart(BenchmarkInfo::InitPhase::kExecutor));
    }
    ABSL_ASSIGN_OR_RETURN(OwnedEnvironment createdEnvironment,
        litert::lm::CreateEnvironment(settings, resources.get()));
    auto environment = std::make_unique<OwnedEnvironment>(std::move(createdEnvironment));
    ABSL_ASSIGN_OR_RETURN(std::unique_ptr<litert::lm::LlmExecutor> executor,
        litert::lm::CreateLlmLiteRtCompiledModelExecutor(
            settings.GetMainExecutorSettings(), environment->env, *resources));
    if (benchmarkInfo.has_value()) {
        ABSL_RETURN_IF_ERROR(benchmarkInfo->TimeInitPhaseEnd(BenchmarkInfo::InitPhase::kExecutor));
    }
    if (hasModelType) {
        ABSL_ASSIGN_OR_RETURN(tokenizer, tokenizerFuture.get());
        ABSL_RETURN_IF_ERROR(UpdateTextSettings(settings, tokenizer.get(), metadata, promptHint, *resources));
        ABSL_RETURN_IF_ERROR(executor->UpdateExecutorSettings(settings.GetMainExecutorSettings()));
    }
    if (benchmarkInfo.has_value()) {
        ABSL_RETURN_IF_ERROR(
            benchmarkInfo->InitPhaseRecord(BenchmarkInfo::InitPhase::kTokenizer, tokenizerDuration));
    }
    ABSL_ASSIGN_OR_RETURN(std::unique_ptr<TextExecutionManager> executionManager,
        TextExecutionManager::Create(tokenizer.get(), std::move(executor), &environment->env));
    if (benchmarkInfo.has_value()) {
        ABSL_RETURN_IF_ERROR(benchmarkInfo->TimeInitPhaseEnd(BenchmarkInfo::InitPhase::kTotal));
    }
    return std::make_unique<TextEngine>(
        std::move(settings), std::move(resources), std::move(environment), std::move(tokenizer),
        std::shared_ptr<TextExecutionManager>(std::move(executionManager)), std::move(benchmarkInfo));
}

}

LITERT_LM_REGISTER_ENGINE(
    litert::lm::EngineFactory::EngineType::kAdvancedLiteRTCompiledModel,
    [](EngineSettings settings, absl::string_view promptHint) {
        return CreateTextEngine(std::move(settings), promptHint);
    });

}
