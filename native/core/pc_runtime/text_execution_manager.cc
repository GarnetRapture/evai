#include "pc_runtime/text_execution_manager.h"

#include <atomic>
#include <functional>
#include <memory>
#include <optional>
#include <tuple>
#include <utility>
#include <variant>
#include <vector>

#include "absl/container/flat_hash_set.h"
#include "absl/functional/any_invocable.h"
#include "absl/log/absl_log.h"
#include "absl/status/status.h"
#include "absl/status/status_macros.h"
#include "absl/status/statusor.h"
#include "absl/strings/str_cat.h"
#include "absl/strings/string_view.h"
#include "absl/synchronization/mutex.h"
#include "absl/time/time.h"
#include "litert/cc/litert_macros.h"
#include "litert/cc/litert_tensor_buffer.h"
#include "runtime/components/sampler.h"
#include "runtime/components/sampler_factory.h"
#include "runtime/components/stop_token_detector.h"
#include "runtime/core/tasks.h"
#include "runtime/engine/engine.h"
#include "runtime/executor/executor_settings_base.h"
#include "runtime/util/convert_tensor_buffer.h"

namespace eversoul::pc_runtime {
namespace {

using litert::lm::BenchmarkInfo;
using litert::lm::ExecutorInputs;
using litert::lm::ExecutorTextData;
using litert::lm::InputData;
using litert::lm::InputText;
using litert::lm::IsTaskEndState;
using litert::lm::Responses;
using litert::lm::SessionId;
using litert::lm::SessionInfo;
using litert::lm::StopTokenDetector;
using litert::lm::TaskId;
using litert::lm::TaskInfo;
using litert::lm::TaskState;

constexpr absl::string_view kAudioUnsupported = "pc_text_runtime_has_no_audio_executor";
constexpr absl::string_view kVisionUnsupported = "pc_text_runtime_has_no_vision_executor";

absl::StatusOr<std::unique_ptr<StopTokenDetector>> CreateStopTokenDetector(
    const litert::lm::SessionConfig& sessionConfig) {
    auto detector = std::make_unique<StopTokenDetector>(1);
    for (const auto& sequence : sessionConfig.GetStopTokenIds()) {
        ABSL_RETURN_IF_ERROR(detector->AddStopTokenSequence(sequence));
    }
    return detector;
}

}

TextExecutionManager::TextExecutionManager(
    litert::support::Tokenizer* tokenizer,
    std::unique_ptr<TextResourceManager> resourceManager,
    litert::Environment* litertEnvironment)
    : tokenizer_(tokenizer),
      resourceManager_(std::move(resourceManager)),
      litertEnvironment_(litertEnvironment),
      executionThreadPool_(std::make_unique<litert::lm::ThreadPool>("pc_text_execution", 1)),
      callbackThreadPool_(std::make_unique<litert::lm::ThreadPool>("pc_text_callback", 1)) {}

TextExecutionManager::~TextExecutionManager() {
    const absl::Status waitStatus = WaitUntilAllDone(litert::lm::Engine::kDefaultTimeout);
    if (!waitStatus.ok()) {
        ABSL_LOG(ERROR) << "pc_text_runtime_shutdown_wait_failed: " << waitStatus;
    }
    executionThreadPool_.reset();
    callbackThreadPool_.reset();
    {
        absl::MutexLock lock(lookupMutex_);
        tasks_.clear();
        sessions_.clear();
    }
    resourceManager_.reset();
}

absl::StatusOr<std::unique_ptr<TextExecutionManager>> TextExecutionManager::Create(
    litert::support::Tokenizer* tokenizer,
    std::unique_ptr<litert::lm::LlmExecutor> llmExecutor,
    litert::Environment* litertEnvironment) {
    if (tokenizer == nullptr) {
        return absl::InvalidArgumentError("pc_text_runtime_missing_tokenizer");
    }
    ABSL_ASSIGN_OR_RETURN(auto resourceManager, TextResourceManager::Create(std::move(llmExecutor)));
    return std::unique_ptr<TextExecutionManager>(
        new TextExecutionManager(tokenizer, std::move(resourceManager), litertEnvironment));
}

absl::StatusOr<SessionId> TextExecutionManager::RegisterNewSession(
    litert::lm::SessionConfig sessionConfig, std::optional<BenchmarkInfo> benchmarkInfo) {
    ABSL_ASSIGN_OR_RETURN(auto contextHandler, resourceManager_->CreateContextHandler(sessionConfig));
    std::unique_ptr<litert::lm::Sampler> sampler;
    if (sessionConfig.UseExternalSampler()) {
        if (sessionConfig.GetSamplerBackend() != litert::lm::Backend::CPU) {
            return absl::InvalidArgumentError("pc_text_runtime_external_sampler_requires_cpu");
        }
        ABSL_ASSIGN_OR_RETURN(
            sampler,
            litert::lm::CreateSampler(
                sessionConfig.GetSamplerBackend(),
                sessionConfig.GetNumOutputCandidates(),
                sessionConfig.GetSamplerParams(),
                litertEnvironment_ == nullptr
                    ? std::nullopt
                    : std::optional<std::reference_wrapper<const litert::Environment>>(*litertEnvironment_)));
    }
    ABSL_ASSIGN_OR_RETURN(auto stopTokenDetector, CreateStopTokenDetector(sessionConfig));
    const SessionId sessionId = nextSessionId_.fetch_add(1);
    auto sessionInfo = std::make_shared<SessionInfo>(SessionInfo{
        .session_config = std::move(sessionConfig),
        .context_handler = std::move(contextHandler),
        .sampler = std::move(sampler),
        .stop_token_detector = std::move(stopTokenDetector),
        .benchmark_info = std::move(benchmarkInfo),
    });
    absl::MutexLock lock(lookupMutex_);
    if (sessions_.contains(sessionId)) {
        return absl::AlreadyExistsError(absl::StrCat("pc_text_runtime_session_exists:", sessionId));
    }
    sessions_.insert({sessionId, std::move(sessionInfo)});
    return sessionId;
}

absl::Status TextExecutionManager::ReleaseSession(SessionId sessionId) {
    absl::MutexLock lock(lookupMutex_);
    if (!sessions_.contains(sessionId)) {
        return absl::NotFoundError(absl::StrCat("pc_text_runtime_session_not_found:", sessionId));
    }
    absl::erase_if(tasks_, [sessionId](const auto& entry) { return entry.second.session_id == sessionId; });
    sessions_.erase(sessionId);
    if (sessions_.empty()) {
        resourceManager_->ResetCurrentHandler();
    }
    return absl::OkStatus();
}

absl::Status TextExecutionManager::CancelAllTasksInSession(SessionId sessionId) {
    absl::MutexLock lock(lookupMutex_);
    if (!sessions_.contains(sessionId)) {
        return absl::NotFoundError(absl::StrCat("pc_text_runtime_session_not_found:", sessionId));
    }
    for (const TaskId taskId : sessions_.at(sessionId)->active_tasks) {
        tasks_.at(taskId).cancelled->store(true);
    }
    return absl::OkStatus();
}

absl::StatusOr<std::shared_ptr<const SessionInfo>> TextExecutionManager::GetSessionInfo(SessionId sessionId) {
    absl::MutexLock lock(lookupMutex_);
    if (!sessions_.contains(sessionId)) {
        return absl::NotFoundError(absl::StrCat("pc_text_runtime_session_not_found:", sessionId));
    }
    return std::shared_ptr<const SessionInfo>(sessions_.at(sessionId));
}

absl::StatusOr<BenchmarkInfo*> TextExecutionManager::GetMutableBenchmarkInfo(SessionId sessionId) {
    absl::MutexLock lock(lookupMutex_);
    if (!sessions_.contains(sessionId)) {
        return absl::NotFoundError(absl::StrCat("pc_text_runtime_session_not_found:", sessionId));
    }
    auto& benchmarkInfo = sessions_.at(sessionId)->benchmark_info;
    if (!benchmarkInfo.has_value()) {
        return absl::FailedPreconditionError(absl::StrCat("pc_text_runtime_session_without_benchmark:", sessionId));
    }
    return &benchmarkInfo.value();
}

absl::StatusOr<TaskId> TextExecutionManager::GetNewTaskId() {
    return nextTaskId_.fetch_add(1);
}

absl::Status TextExecutionManager::CreateTask(
    SessionId sessionId,
    TaskId taskId,
    absl::AnyInvocable<void()> task,
    absl::flat_hash_set<TaskId> dependentTasks,
    std::shared_ptr<std::atomic<bool>> cancelled,
    TaskCallback callback) {
    absl::MutexLock lock(lookupMutex_);
    if (!sessions_.contains(sessionId)) {
        return absl::NotFoundError(absl::StrCat("pc_text_runtime_session_not_found:", sessionId));
    }
    if (tasks_.contains(taskId)) {
        return absl::AlreadyExistsError(absl::StrCat("pc_text_runtime_task_exists:", taskId));
    }
    TaskState taskState = TaskState::kCreated;
    for (auto iterator = dependentTasks.begin(); iterator != dependentTasks.end();) {
        const TaskId dependentTaskId = *iterator;
        bool resolved = false;
        auto dependent = tasks_.find(dependentTaskId);
        if (dependent == tasks_.end()) {
            if (dependentTaskId >= nextTaskId_.load()) {
                return absl::InvalidArgumentError(absl::StrCat("pc_text_runtime_invalid_dependency:", dependentTaskId));
            }
            resolved = true;
        }
        else if (IsTaskEndState(dependent->second.task_state)) {
            switch (dependent->second.task_state) {
            case TaskState::kFailed:
            case TaskState::kDependentTaskFailed:
                taskState = TaskState::kDependentTaskFailed;
                break;
            case TaskState::kCancelled:
            case TaskState::kDependentTaskCancelled:
                if (taskState != TaskState::kDependentTaskFailed) taskState = TaskState::kDependentTaskCancelled;
                break;
            case TaskState::kDone:
                break;
            case TaskState::kMaxNumTokensReached:
                if (taskState == TaskState::kCreated) taskState = TaskState::kMaxNumTokensReached;
                break;
            default:
                return absl::InvalidArgumentError(
                    absl::StrCat("pc_text_runtime_unexpected_dependency_end_state:", dependentTaskId));
            }
            resolved = true;
        }
        else if (dependent->second.task_state == TaskState::kLastCallbackQueued) {
            resolved = true;
        }
        else {
            dependent->second.following_tasks.insert(taskId);
        }
        auto current = iterator++;
        if (resolved) dependentTasks.erase(current);
    }
    if (!IsTaskEndState(taskState)) {
        sessions_.at(sessionId)->active_tasks.insert(taskId);
    }
    TaskInfo taskInfo;
    taskInfo.session_id = sessionId;
    taskInfo.task_state = taskState;
    taskInfo.task = std::move(task);
    taskInfo.dependent_tasks = std::move(dependentTasks);
    taskInfo.cancelled = std::move(cancelled);
    taskInfo.callback = std::move(callback);
    auto [inserted, insertedNew] = tasks_.insert({taskId, std::move(taskInfo)});
    inserted->second.callback(Responses(taskState));
    if (taskState == TaskState::kCreated && inserted->second.dependent_tasks.empty()) {
        return QueueTask(taskId);
    }
    return absl::OkStatus();
}

absl::Status TextExecutionManager::QueueTask(TaskId taskId) {
    auto found = tasks_.find(taskId);
    if (found == tasks_.end()) {
        return absl::NotFoundError(absl::StrCat("pc_text_runtime_task_not_found:", taskId));
    }
    TaskInfo& taskInfo = found->second;
    if (taskInfo.task_state != TaskState::kCreated || !taskInfo.dependent_tasks.empty()) {
        const absl::Status status =
            absl::FailedPreconditionError(absl::StrCat("pc_text_runtime_task_not_queueable:", taskId));
        taskInfo.callback(status);
        return status;
    }
    ABSL_RETURN_IF_ERROR(executionThreadPool_->Schedule(std::move(taskInfo.task)));
    taskInfo.callback(Responses(TaskState::kQueued));
    return UpdateTaskState(taskId, TaskState::kQueued);
}

absl::StatusOr<TextExecutionManager::StartedTask> TextExecutionManager::StartTask(TaskId taskId) {
    absl::MutexLock lock(lookupMutex_);
    auto found = tasks_.find(taskId);
    if (found == tasks_.end()) {
        return absl::NotFoundError(absl::StrCat("pc_text_runtime_task_not_found:", taskId));
    }
    TaskInfo& taskInfo = found->second;
    if (taskInfo.task_state == TaskState::kCancelled) {
        return StartedTask(nullptr, nullptr, nullptr);
    }
    if (taskInfo.callback == nullptr) {
        return absl::FailedPreconditionError(absl::StrCat("pc_text_runtime_task_without_callback:", taskId));
    }
    if (taskInfo.task_state != TaskState::kQueued) {
        const absl::Status status =
            absl::FailedPreconditionError(absl::StrCat("pc_text_runtime_task_not_queued:", taskId));
        taskInfo.callback(status);
        return status;
    }
    taskInfo.callback(Responses(TaskState::kProcessing));
    ABSL_RETURN_IF_ERROR(UpdateTaskState(taskId, TaskState::kProcessing));
    auto session = sessions_.find(taskInfo.session_id);
    if (session == sessions_.end()) {
        return absl::NotFoundError(absl::StrCat("pc_text_runtime_session_not_found:", taskInfo.session_id));
    }
    return StartedTask(session->second, taskInfo.cancelled, std::move(taskInfo.callback));
}

absl::Status TextExecutionManager::FinishTask(
    TaskId taskId, absl::StatusOr<Responses> responses, TaskCallback callback) {
    {
        absl::MutexLock lock(lookupMutex_);
        auto fail = [&](absl::Status status) ABSL_EXCLUSIVE_LOCKS_REQUIRED(lookupMutex_) -> absl::Status {
            callback(status);
            ABSL_RETURN_IF_ERROR(UpdateTaskState(taskId, TaskState::kFailed));
            return status;
        };
        auto found = tasks_.find(taskId);
        if (found == tasks_.end()) {
            return absl::NotFoundError(absl::StrCat("pc_text_runtime_task_not_found:", taskId));
        }
        if (found->second.task_state != TaskState::kProcessing) {
            return fail(absl::FailedPreconditionError(absl::StrCat("pc_text_runtime_task_not_processing:", taskId)));
        }
        if (!responses.ok() || responses->GetTaskState() == TaskState::kCancelled) {
            auto waiting = FollowingWaitingTasks(taskId);
            if (!waiting.ok()) return fail(waiting.status());
            const absl::Status propagation = UpdateAllTasksToState(
                *waiting, responses.ok() ? TaskState::kDependentTaskCancelled : TaskState::kDependentTaskFailed);
            if (!propagation.ok()) return fail(propagation);
        }
        else if (responses->GetTaskState() == TaskState::kDone
                 || responses->GetTaskState() == TaskState::kMaxNumTokensReached) {
            for (const TaskId followingTaskId : found->second.following_tasks) {
                auto following = tasks_.find(followingTaskId);
                if (following == tasks_.end()) {
                    return fail(absl::NotFoundError(
                        absl::StrCat("pc_text_runtime_following_task_not_found:", followingTaskId)));
                }
                if (IsTaskEndState(following->second.task_state)) continue;
                if (following->second.task_state != TaskState::kCreated
                    || !following->second.dependent_tasks.contains(taskId)) {
                    return fail(absl::FailedPreconditionError(
                        absl::StrCat("pc_text_runtime_following_task_inconsistent:", followingTaskId)));
                }
                following->second.dependent_tasks.erase(taskId);
                if (following->second.dependent_tasks.empty()) {
                    ABSL_RETURN_IF_ERROR(QueueTask(followingTaskId));
                }
            }
        }
        else if (!IsTaskEndState(responses->GetTaskState())) {
            return fail(absl::InvalidArgumentError(absl::StrCat("pc_text_runtime_task_result_not_final:", taskId)));
        }
        const TaskState finalState = responses.ok() ? responses->GetTaskState() : TaskState::kFailed;
        ABSL_RETURN_IF_ERROR(callbackThreadPool_->Schedule(
            [this, callback = std::move(callback), responses = std::move(responses), taskId, finalState]() mutable {
                callback(std::move(responses));
                absl::MutexLock callbackLock(lookupMutex_);
                const absl::Status status = UpdateTaskState(taskId, finalState);
                if (!status.ok()) {
                    ABSL_LOG(ERROR) << "pc_text_runtime_task_state_update_failed: " << status;
                }
            }));
        ABSL_RETURN_IF_ERROR(UpdateTaskState(taskId, TaskState::kLastCallbackQueued));
    }
    return callbackThreadPool_->WaitUntilDone(absl::Seconds(10));
}

void TextExecutionManager::FinishTaskAndLogErrors(
    TaskId taskId, absl::StatusOr<Responses> responses, TaskCallback callback) {
    const absl::Status status = FinishTask(taskId, std::move(responses), std::move(callback));
    if (!status.ok()) {
        ABSL_LOG(ERROR) << "pc_text_runtime_finish_task_failed: " << status << " task=" << taskId;
    }
}

absl::StatusOr<absl::flat_hash_set<TaskId>> TextExecutionManager::FollowingWaitingTasks(TaskId taskId) {
    absl::flat_hash_set<TaskId> waiting;
    for (const TaskId followingTaskId : tasks_.at(taskId).following_tasks) {
        auto following = tasks_.find(followingTaskId);
        if (following == tasks_.end() || !following->second.dependent_tasks.contains(taskId)) {
            return absl::FailedPreconditionError(
                absl::StrCat("pc_text_runtime_following_task_inconsistent:", followingTaskId));
        }
        if (!IsTaskEndState(following->second.task_state)) {
            waiting.insert(followingTaskId);
            ABSL_ASSIGN_OR_RETURN(auto transitive, FollowingWaitingTasks(followingTaskId));
            waiting.insert(transitive.begin(), transitive.end());
        }
    }
    return waiting;
}

absl::Status TextExecutionManager::UpdateTaskState(TaskId taskId, TaskState taskState) {
    auto found = tasks_.find(taskId);
    if (found == tasks_.end()) {
        return absl::NotFoundError(absl::StrCat("pc_text_runtime_task_not_found:", taskId));
    }
    if (!IsTaskEndState(found->second.task_state) && IsTaskEndState(taskState)) {
        auto session = sessions_.find(found->second.session_id);
        if (session == sessions_.end() || !session->second->active_tasks.contains(taskId)) {
            const absl::Status status =
                absl::InternalError(absl::StrCat("pc_text_runtime_task_not_active:", taskId));
            if (found->second.callback != nullptr) found->second.callback(status);
            return status;
        }
        session->second->active_tasks.erase(taskId);
    }
    found->second.task_state = taskState;
    return absl::OkStatus();
}

absl::Status TextExecutionManager::UpdateAllTasksToState(
    const absl::flat_hash_set<TaskId>& taskIds, TaskState taskState) {
    for (const TaskId taskId : taskIds) {
        TaskInfo& taskInfo = tasks_.at(taskId);
        taskInfo.dependent_tasks.clear();
        if (taskInfo.callback) taskInfo.callback(Responses(taskState));
        ABSL_RETURN_IF_ERROR(UpdateTaskState(taskId, taskState));
    }
    return absl::OkStatus();
}

absl::StatusOr<ExecutorInputs> TextExecutionManager::CombineTextContents(const std::vector<InputData>& contents) {
    std::vector<int> combinedTokenIds;
    for (const InputData& content : contents) {
        const auto* text = std::get_if<InputText>(&content);
        if (text == nullptr) {
            return absl::InvalidArgumentError("pc_text_runtime_rejects_multimodal_input");
        }
        ABSL_ASSIGN_OR_RETURN(const auto* tokenIds, text->GetPreprocessedTextTensor());
        if (tokenIds == nullptr) {
            return absl::InvalidArgumentError("pc_text_runtime_missing_preprocessed_text");
        }
        LITERT_ASSIGN_OR_RETURN(auto tokenSpan, litert::lm::ReferTensorBufferAsSpan<int>(*tokenIds));
        combinedTokenIds.insert(combinedTokenIds.end(), tokenSpan.begin(), tokenSpan.end());
    }
    if (combinedTokenIds.empty()) {
        return absl::InvalidArgumentError("No token IDs found in preprocessed_contents.");
    }
    ABSL_ASSIGN_OR_RETURN(auto tokenBuffer, tokenizer_->TokenIdsToTensorBuffer(combinedTokenIds));
    return ExecutorInputs(ExecutorTextData(std::move(tokenBuffer)), std::nullopt, std::nullopt);
}

absl::Status TextExecutionManager::WaitUntilDone(TaskId taskId, absl::Duration timeout) {
    auto done = [this, taskId]() ABSL_SHARED_LOCKS_REQUIRED(lookupMutex_) {
        auto found = tasks_.find(taskId);
        return found != tasks_.end() && IsTaskEndState(found->second.task_state);
    };
    absl::MutexLock lock(lookupMutex_);
    if (lookupMutex_.AwaitWithTimeout(absl::Condition(&done), timeout)) return absl::OkStatus();
    return absl::DeadlineExceededError(absl::StrCat("pc_text_runtime_task_timeout:", taskId));
}

absl::Status TextExecutionManager::WaitUntilSessionDone(SessionId sessionId, absl::Duration timeout) {
    auto done = [this, sessionId]() ABSL_SHARED_LOCKS_REQUIRED(lookupMutex_) {
        auto found = sessions_.find(sessionId);
        return found != sessions_.end() && found->second->active_tasks.empty();
    };
    absl::MutexLock lock(lookupMutex_);
    if (lookupMutex_.AwaitWithTimeout(absl::Condition(&done), timeout)) return absl::OkStatus();
    return absl::DeadlineExceededError(absl::StrCat("pc_text_runtime_session_timeout:", sessionId));
}

absl::Status TextExecutionManager::WaitUntilAllDone(absl::Duration timeout) {
    if (executionThreadPool_ != nullptr) ABSL_RETURN_IF_ERROR(executionThreadPool_->WaitUntilDone(timeout));
    if (callbackThreadPool_ != nullptr) ABSL_RETURN_IF_ERROR(callbackThreadPool_->WaitUntilDone(timeout));
    return absl::OkStatus();
}

absl::Status TextExecutionManager::AddPrefillTask(
    SessionId sessionId,
    TaskId taskId,
    std::vector<InputData> inputs,
    absl::flat_hash_set<TaskId> dependentTasks,
    std::shared_ptr<std::atomic<bool>> cancelled,
    TaskCallback callback) {
    if (callback == nullptr) callback = [](absl::StatusOr<Responses>) {};
    auto task = [this, taskId, inputs = std::move(inputs)]() mutable {
        auto started = StartTask(taskId);
        if (!started.ok()) {
            FinishTaskAndLogErrors(taskId, started.status(), [](absl::StatusOr<Responses>) {});
            return;
        }
        auto [sessionInfo, taskCancelled, taskCallback] = std::move(started.value());
        if (sessionInfo == nullptr) return;
        if (taskCancelled->load()) {
            FinishTaskAndLogErrors(taskId, Responses(TaskState::kCancelled), std::move(taskCallback));
            return;
        }
        auto executor = resourceManager_->AcquireExecutorWithContextHandler(sessionInfo->context_handler);
        if (!executor.ok()) {
            FinishTaskAndLogErrors(taskId, executor.status(), std::move(taskCallback));
            return;
        }
        auto executorInputs = CombineTextContents(inputs);
        if (!executorInputs.ok() || taskCancelled->load()) {
            executor.value().reset();
            FinishTaskAndLogErrors(
                taskId,
                executorInputs.ok() ? absl::StatusOr<Responses>(Responses(TaskState::kCancelled))
                                    : absl::StatusOr<Responses>(executorInputs.status()),
                std::move(taskCallback));
            return;
        }
        auto responses = litert::lm::Tasks::Prefill(
            *executor.value(), *executorInputs, true, sessionInfo->benchmark_info);
        if (responses.ok()) {
            if (taskCancelled->load()) {
                responses = Responses(TaskState::kCancelled);
            }
            else {
                auto processedTokens = executor.value()->GetProcessedTokens();
                auto currentStep = executor.value()->GetCurrentStep();
                if (!processedTokens.ok()) {
                    responses = processedTokens.status();
                }
                else if (!currentStep.ok()) {
                    responses = currentStep.status();
                }
                else {
                    sessionInfo->last_prefill_token_id =
                        processedTokens.value()->GetTokenAtStep(currentStep.value() - 1).at(0);
                }
            }
        }
        executor.value().reset();
        FinishTaskAndLogErrors(taskId, std::move(responses), std::move(taskCallback));
    };
    return CreateTask(sessionId, taskId, std::move(task), std::move(dependentTasks), std::move(cancelled),
        std::move(callback));
}

absl::Status TextExecutionManager::AddDecodeTask(
    SessionId sessionId,
    TaskId taskId,
    absl::flat_hash_set<TaskId> dependentTasks,
    litert::lm::RepetitionPenaltyConfig repetitionPenaltyConfig,
    litert::lm::NoRepeatNgramConfig noRepeatNgramConfig,
    litert::lm::SuppressTokensConfig suppressTokensConfig,
    litert::lm::Constraint* constraint,
    std::shared_ptr<std::atomic<bool>> cancelled,
    TaskCallback callback,
    int maxOutputTokens,
    std::optional<int> thinkingTokenBudget,
    std::vector<int> thinkingStartTokenIds,
    std::vector<int> thinkingEndTokenIds) {
    if (callback == nullptr) callback = [](absl::StatusOr<Responses>) {};
    auto task = [this, taskId,
                 repetitionPenaltyConfig = std::move(repetitionPenaltyConfig),
                 noRepeatNgramConfig = std::move(noRepeatNgramConfig),
                 suppressTokensConfig = std::move(suppressTokensConfig),
                 constraint, maxOutputTokens, thinkingTokenBudget,
                 thinkingStartTokenIds = std::move(thinkingStartTokenIds),
                 thinkingEndTokenIds = std::move(thinkingEndTokenIds)]() mutable {
        auto started = StartTask(taskId);
        if (!started.ok()) {
            FinishTaskAndLogErrors(taskId, started.status(), [](absl::StatusOr<Responses>) {});
            return;
        }
        auto [sessionInfo, taskCancelled, taskCallback] = std::move(started.value());
        if (sessionInfo == nullptr) return;
        if (taskCancelled->load()) {
            FinishTaskAndLogErrors(taskId, Responses(TaskState::kCancelled), std::move(taskCallback));
            return;
        }
        auto executor = resourceManager_->AcquireExecutorWithContextHandler(sessionInfo->context_handler);
        if (!executor.ok()) {
            FinishTaskAndLogErrors(taskId, executor.status(), std::move(taskCallback));
            return;
        }
        const int candidates = sessionInfo->session_config.GetNumOutputCandidates();
        sessionInfo->stop_token_detector->ResetBatch(candidates);
        std::optional<litert::lm::Sampler*> sampler;
        std::optional<litert::TensorBuffer> decodedIds;
        if (sessionInfo->sampler != nullptr) {
            sampler = sessionInfo->sampler.get();
            std::vector<int> seedIds(candidates, sessionInfo->last_prefill_token_id);
            auto seedBuffer = litert::lm::CopyToTensorBuffer<int>(seedIds, {candidates, 1});
            if (!seedBuffer.HasValue()) {
                executor.value().reset();
                FinishTaskAndLogErrors(
                    taskId, absl::InternalError(seedBuffer.Error().Message()), std::move(taskCallback));
                return;
            }
            decodedIds = std::move(seedBuffer.Value());
        }
        auto responses = litert::lm::Tasks::Decode(
            *executor.value(), *tokenizer_, *sessionInfo->stop_token_detector, candidates,
            sessionInfo->benchmark_info, sampler, std::move(repetitionPenaltyConfig),
            std::move(noRepeatNgramConfig), std::move(suppressTokensConfig), constraint,
            std::move(decodedIds), taskCallback, taskCancelled.get(), maxOutputTokens, thinkingTokenBudget,
            thinkingEndTokenIds, thinkingStartTokenIds,
            sessionInfo->session_config.GetEnableSpeculativeDecoding());
        if ((!responses.ok() && absl::IsCancelled(responses.status())) || taskCancelled->load()) {
            responses = Responses(TaskState::kCancelled);
        }
        executor.value().reset();
        FinishTaskAndLogErrors(taskId, std::move(responses), std::move(taskCallback));
    };
    return CreateTask(sessionId, taskId, std::move(task), std::move(dependentTasks), std::move(cancelled),
        std::move(callback));
}

absl::Status TextExecutionManager::AddCloneSessionTask(
    SessionId sessionId,
    TaskId taskId,
    absl::flat_hash_set<TaskId> dependentTasks,
    SessionId clonedSessionId,
    std::shared_ptr<std::atomic<bool>> cancelled,
    TaskCallback callback) {
    if (callback == nullptr) callback = [](absl::StatusOr<Responses>) {};
    auto task = [this, taskId, sessionId, clonedSessionId]() mutable {
        auto started = StartTask(taskId);
        if (!started.ok()) {
            FinishTaskAndLogErrors(taskId, started.status(), [](absl::StatusOr<Responses>) {});
            return;
        }
        auto [sessionInfo, taskCancelled, taskCallback] = std::move(started.value());
        if (sessionInfo == nullptr) return;
        auto cloneSession = [&]() -> absl::StatusOr<Responses> {
            std::shared_ptr<const SessionInfo> original;
            {
                absl::MutexLock lock(lookupMutex_);
                auto found = sessions_.find(sessionId);
                if (found == sessions_.end()) {
                    return absl::NotFoundError(absl::StrCat("pc_text_runtime_session_not_found:", sessionId));
                }
                original = found->second;
            }
            ABSL_ASSIGN_OR_RETURN(auto clonedHandler, resourceManager_->CloneContextHandler(original->context_handler));
            std::unique_ptr<litert::lm::Sampler> clonedSampler;
            if (original->sampler != nullptr) {
                ABSL_ASSIGN_OR_RETURN(
                    clonedSampler,
                    litert::lm::CreateSampler(
                        original->session_config.GetSamplerBackend(),
                        original->session_config.GetNumOutputCandidates(),
                        original->session_config.GetSamplerParams()));
            }
            ABSL_ASSIGN_OR_RETURN(auto clonedDetector, CreateStopTokenDetector(original->session_config));
            absl::MutexLock lock(lookupMutex_);
            auto cloned = sessions_.find(clonedSessionId);
            if (cloned == sessions_.end()) {
                return absl::NotFoundError(absl::StrCat("pc_text_runtime_session_not_found:", clonedSessionId));
            }
            cloned->second->session_config = original->session_config;
            cloned->second->context_handler = std::move(clonedHandler);
            cloned->second->sampler = std::move(clonedSampler);
            cloned->second->last_prefill_token_id = original->last_prefill_token_id;
            cloned->second->stop_token_detector = std::move(clonedDetector);
            cloned->second->benchmark_info = original->benchmark_info;
            return Responses(TaskState::kDone);
        };
        absl::StatusOr<Responses> result = taskCancelled->load()
            ? absl::StatusOr<Responses>(Responses(TaskState::kCancelled))
            : cloneSession();
        if (result.ok() && taskCancelled->load()) {
            result = Responses(TaskState::kCancelled);
        }
        FinishTaskAndLogErrors(taskId, std::move(result), std::move(taskCallback));
    };
    return CreateTask(clonedSessionId, taskId, std::move(task), std::move(dependentTasks), std::move(cancelled),
        std::move(callback));
}

absl::Status TextExecutionManager::AddTextScoringTask(
    SessionId sessionId,
    TaskId taskId,
    absl::flat_hash_set<TaskId> dependentTasks,
    const std::vector<absl::string_view>& targetText,
    bool storeTokenLengths,
    std::shared_ptr<std::atomic<bool>> cancelled,
    TaskCallback callback) {
    if (callback == nullptr) callback = [](absl::StatusOr<Responses>) {};
    auto task = [this, taskId, targetText, storeTokenLengths]() mutable {
        auto started = StartTask(taskId);
        if (!started.ok()) {
            FinishTaskAndLogErrors(taskId, started.status(), [](absl::StatusOr<Responses>) {});
            return;
        }
        auto [sessionInfo, taskCancelled, taskCallback] = std::move(started.value());
        if (sessionInfo == nullptr) return;
        if (taskCancelled->load()) {
            FinishTaskAndLogErrors(taskId, Responses(TaskState::kCancelled), std::move(taskCallback));
            return;
        }
        auto executor = resourceManager_->AcquireExecutorWithContextHandler(sessionInfo->context_handler);
        if (!executor.ok()) {
            FinishTaskAndLogErrors(taskId, executor.status(), std::move(taskCallback));
            return;
        }
        const int candidates = sessionInfo->session_config.GetNumOutputCandidates();
        std::vector<int> seedIds(candidates, sessionInfo->last_prefill_token_id);
        auto seedBuffer = litert::lm::CopyToTensorBuffer<int>(seedIds, {candidates, 1});
        if (!seedBuffer.HasValue()) {
            executor.value().reset();
            FinishTaskAndLogErrors(taskId, absl::InternalError(seedBuffer.Error().Message()), std::move(taskCallback));
            return;
        }
        auto responses = litert::lm::Tasks::Score(
            *executor.value(), *tokenizer_, targetText, 1.0f, std::move(seedBuffer.Value()), storeTokenLengths);
        if (taskCancelled->load()) {
            responses = Responses(TaskState::kCancelled);
        }
        executor.value().reset();
        FinishTaskAndLogErrors(taskId, std::move(responses), std::move(taskCallback));
    };
    return CreateTask(sessionId, taskId, std::move(task), std::move(dependentTasks), std::move(cancelled),
        std::move(callback));
}

absl::StatusOr<int> TextExecutionManager::GetCurrentStep(const SessionInfo& sessionInfo) {
    ABSL_ASSIGN_OR_RETURN(auto executor, resourceManager_->AcquireExecutorWithContextHandler(sessionInfo.context_handler));
    return executor->GetCurrentStep();
}

absl::Status TextExecutionManager::SetCurrentStep(const SessionInfo& sessionInfo, int targetStep) {
    ABSL_ASSIGN_OR_RETURN(auto executor, resourceManager_->AcquireExecutorWithContextHandler(sessionInfo.context_handler));
    ABSL_ASSIGN_OR_RETURN(int currentStep, executor->GetCurrentStep());
    if (targetStep > currentStep) {
        return absl::InvalidArgumentError(absl::StrCat("pc_text_runtime_step_beyond_current:", currentStep));
    }
    return executor->SetCurrentStep(targetStep);
}

absl::StatusOr<litert::lm::AudioExecutorProperties> TextExecutionManager::GetAudioExecutorProperties() const {
    return absl::UnimplementedError(kAudioUnsupported);
}

absl::StatusOr<litert::lm::ExecutorAudioData> TextExecutionManager::EncodeAudio(
    const SessionInfo&, const litert::TensorBuffer&) {
    return absl::UnimplementedError(kAudioUnsupported);
}

absl::Status TextExecutionManager::ResetAudio(const SessionInfo&) {
    return absl::UnimplementedError(kAudioUnsupported);
}

absl::StatusOr<litert::lm::ExecutorAudioData> TextExecutionManager::FlushAudio(const SessionInfo&) {
    return absl::UnimplementedError(kAudioUnsupported);
}

absl::StatusOr<litert::lm::VisionExecutorProperties> TextExecutionManager::GetVisionExecutorProperties() const {
    return absl::UnimplementedError(kVisionUnsupported);
}

}
