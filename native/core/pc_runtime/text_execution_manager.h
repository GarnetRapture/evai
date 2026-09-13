#pragma once

#include <atomic>
#include <memory>
#include <optional>
#include <tuple>
#include <vector>

#include "absl/base/nullability.h"
#include "absl/base/thread_annotations.h"
#include "absl/container/flat_hash_map.h"
#include "absl/container/flat_hash_set.h"
#include "absl/functional/any_invocable.h"
#include "absl/status/status.h"
#include "absl/status/statusor.h"
#include "absl/strings/string_view.h"
#include "absl/synchronization/mutex.h"
#include "absl/time/time.h"
#include "litert/cc/litert_environment.h"
#include "litert/cc/litert_tensor_buffer.h"
#include "pc_runtime/text_resource_manager.h"
#include "runtime/components/constrained_decoding/constraint.h"
#include "runtime/components/constrained_decoding/no_repeat_ngram_config.h"
#include "runtime/components/constrained_decoding/repetition_penalty_config.h"
#include "runtime/components/constrained_decoding/suppress_tokens_config.h"
#include "runtime/engine/engine_settings.h"
#include "runtime/engine/io_types.h"
#include "runtime/executor/llm_executor.h"
#include "runtime/executor/llm_executor_io_types.h"
#include "runtime/framework/resource_management/execution_manager.h"
#include "runtime/framework/threadpool.h"
#include "support/tokenizer/tokenizer.h"

namespace eversoul::pc_runtime {

class TextExecutionManager final : public litert::lm::ExecutionManager {
public:
    static absl::StatusOr<std::unique_ptr<TextExecutionManager>> Create(
        litert::support::Tokenizer* absl_nonnull tokenizer,
        std::unique_ptr<litert::lm::LlmExecutor> absl_nonnull llmExecutor,
        litert::Environment* absl_nullable litertEnvironment);

    ~TextExecutionManager() override;

    absl::Status WaitUntilDone(litert::lm::TaskId taskId, absl::Duration timeout) override;
    absl::Status WaitUntilSessionDone(litert::lm::SessionId sessionId, absl::Duration timeout) override;
    absl::Status WaitUntilAllDone(absl::Duration timeout) override;

    absl::StatusOr<litert::lm::SessionId> RegisterNewSession(
        litert::lm::SessionConfig sessionConfig,
        std::optional<litert::lm::BenchmarkInfo> benchmarkInfo) override;
    absl::Status ReleaseSession(litert::lm::SessionId sessionId) override;
    absl::Status CancelAllTasksInSession(litert::lm::SessionId sessionId) override;
    absl::StatusOr<std::shared_ptr<const litert::lm::SessionInfo>> GetSessionInfo(
        litert::lm::SessionId sessionId) override;
    absl::StatusOr<litert::lm::BenchmarkInfo*> GetMutableBenchmarkInfo(litert::lm::SessionId sessionId) override;
    absl::StatusOr<litert::lm::TaskId> GetNewTaskId() override;

    absl::Status AddPrefillTask(
        litert::lm::SessionId sessionId,
        litert::lm::TaskId taskId,
        std::vector<litert::lm::InputData> inputs,
        absl::flat_hash_set<litert::lm::TaskId> dependentTasks,
        std::shared_ptr<std::atomic<bool>> absl_nonnull cancelled,
        absl::AnyInvocable<void(absl::StatusOr<litert::lm::Responses>)> callback) override;

    absl::Status AddDecodeTask(
        litert::lm::SessionId sessionId,
        litert::lm::TaskId taskId,
        absl::flat_hash_set<litert::lm::TaskId> dependentTasks,
        litert::lm::RepetitionPenaltyConfig repetitionPenaltyConfig,
        litert::lm::NoRepeatNgramConfig noRepeatNgramConfig,
        litert::lm::SuppressTokensConfig suppressTokensConfig,
        litert::lm::Constraint* absl_nullable constraint,
        std::shared_ptr<std::atomic<bool>> absl_nonnull cancelled,
        absl::AnyInvocable<void(absl::StatusOr<litert::lm::Responses>)> callback,
        int maxOutputTokens,
        std::optional<int> thinkingTokenBudget = std::nullopt,
        std::vector<int> thinkingStartTokenIds = {},
        std::vector<int> thinkingEndTokenIds = {}) override;

    absl::Status AddCloneSessionTask(
        litert::lm::SessionId sessionId,
        litert::lm::TaskId taskId,
        absl::flat_hash_set<litert::lm::TaskId> dependentTasks,
        litert::lm::SessionId clonedSessionId,
        std::shared_ptr<std::atomic<bool>> absl_nonnull cancelled,
        absl::AnyInvocable<void(absl::StatusOr<litert::lm::Responses>)> callback) override;

    absl::Status AddTextScoringTask(
        litert::lm::SessionId sessionId,
        litert::lm::TaskId taskId,
        absl::flat_hash_set<litert::lm::TaskId> dependentTasks,
        const std::vector<absl::string_view>& targetText,
        bool storeTokenLengths,
        std::shared_ptr<std::atomic<bool>> absl_nonnull cancelled,
        absl::AnyInvocable<void(absl::StatusOr<litert::lm::Responses>)> callback) override;

    absl::StatusOr<int> GetCurrentStep(const litert::lm::SessionInfo& sessionInfo) override;
    absl::Status SetCurrentStep(const litert::lm::SessionInfo& sessionInfo, int targetStep) override;

    absl::StatusOr<litert::lm::AudioExecutorProperties> GetAudioExecutorProperties() const override;
    absl::StatusOr<litert::lm::ExecutorAudioData> EncodeAudio(
        const litert::lm::SessionInfo& sessionInfo, const litert::TensorBuffer& spectrogramTensor) override;
    absl::Status ResetAudio(const litert::lm::SessionInfo& sessionInfo) override;
    absl::StatusOr<litert::lm::ExecutorAudioData> FlushAudio(const litert::lm::SessionInfo& sessionInfo) override;
    absl::StatusOr<litert::lm::VisionExecutorProperties> GetVisionExecutorProperties() const override;

private:
    using TaskCallback = absl::AnyInvocable<void(absl::StatusOr<litert::lm::Responses>)>;
    using StartedTask = std::tuple<
        std::shared_ptr<litert::lm::SessionInfo>, std::shared_ptr<std::atomic<bool>>, TaskCallback>;

    TextExecutionManager(
        litert::support::Tokenizer* tokenizer,
        std::unique_ptr<TextResourceManager> resourceManager,
        litert::Environment* litertEnvironment);

    absl::Status CreateTask(
        litert::lm::SessionId sessionId,
        litert::lm::TaskId taskId,
        absl::AnyInvocable<void()> task,
        absl::flat_hash_set<litert::lm::TaskId> dependentTasks,
        std::shared_ptr<std::atomic<bool>> cancelled,
        TaskCallback callback);
    absl::Status QueueTask(litert::lm::TaskId taskId) ABSL_EXCLUSIVE_LOCKS_REQUIRED(lookupMutex_);
    absl::StatusOr<StartedTask> StartTask(litert::lm::TaskId taskId);
    absl::Status FinishTask(
        litert::lm::TaskId taskId, absl::StatusOr<litert::lm::Responses> responses, TaskCallback callback);
    void FinishTaskAndLogErrors(
        litert::lm::TaskId taskId, absl::StatusOr<litert::lm::Responses> responses, TaskCallback callback);
    absl::StatusOr<absl::flat_hash_set<litert::lm::TaskId>> FollowingWaitingTasks(litert::lm::TaskId taskId)
        ABSL_EXCLUSIVE_LOCKS_REQUIRED(lookupMutex_);
    absl::Status UpdateTaskState(litert::lm::TaskId taskId, litert::lm::TaskState taskState)
        ABSL_EXCLUSIVE_LOCKS_REQUIRED(lookupMutex_);
    absl::Status UpdateAllTasksToState(
        const absl::flat_hash_set<litert::lm::TaskId>& taskIds, litert::lm::TaskState taskState)
        ABSL_EXCLUSIVE_LOCKS_REQUIRED(lookupMutex_);
    absl::StatusOr<litert::lm::ExecutorInputs> CombineTextContents(
        const std::vector<litert::lm::InputData>& contents);

    litert::support::Tokenizer* tokenizer_;
    std::unique_ptr<TextResourceManager> resourceManager_;
    litert::Environment* litertEnvironment_;
    std::unique_ptr<litert::lm::ThreadPool> executionThreadPool_;
    std::unique_ptr<litert::lm::ThreadPool> callbackThreadPool_;
    std::atomic<litert::lm::SessionId> nextSessionId_{0};
    std::atomic<litert::lm::TaskId> nextTaskId_{0};
    absl::Mutex lookupMutex_;
    absl::flat_hash_map<litert::lm::SessionId, std::shared_ptr<litert::lm::SessionInfo>> sessions_
        ABSL_GUARDED_BY(lookupMutex_);
    absl::flat_hash_map<litert::lm::TaskId, litert::lm::TaskInfo> tasks_ ABSL_GUARDED_BY(lookupMutex_);
};

}
