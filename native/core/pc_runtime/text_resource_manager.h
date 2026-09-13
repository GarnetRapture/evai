#pragma once

#include <memory>

#include "absl/base/nullability.h"
#include "absl/base/thread_annotations.h"
#include "absl/status/status.h"
#include "absl/status/statusor.h"
#include "absl/synchronization/mutex.h"
#include "runtime/engine/engine_settings.h"
#include "runtime/executor/llm_executor.h"
#include "runtime/executor/llm_executor_settings.h"
#include "runtime/framework/resource_management/context_handler/context_handler.h"

namespace eversoul::pc_runtime {

class TextResourceManager {
public:
    static absl::StatusOr<std::unique_ptr<TextResourceManager>> Create(
        std::unique_ptr<litert::lm::LlmExecutor> absl_nonnull llmExecutor);

    ~TextResourceManager();

    TextResourceManager(const TextResourceManager&) = delete;
    TextResourceManager& operator=(const TextResourceManager&) = delete;

    absl::StatusOr<std::unique_ptr<litert::lm::ContextHandler>> CreateContextHandler(
        const litert::lm::SessionConfig& sessionConfig);

    absl::StatusOr<std::unique_ptr<litert::lm::ContextHandler>> CloneContextHandler(
        std::shared_ptr<const litert::lm::ContextHandler> contextHandler);

    absl::StatusOr<std::unique_ptr<litert::lm::LlmExecutor>> AcquireExecutor()
        ABSL_LOCKS_EXCLUDED(executorMutex_);

    absl::StatusOr<std::unique_ptr<litert::lm::LlmExecutor>> AcquireExecutorWithContextHandler(
        std::shared_ptr<litert::lm::ContextHandler> contextHandler)
        ABSL_LOCKS_EXCLUDED(executorMutex_);

    void ResetCurrentHandler() ABSL_LOCKS_EXCLUDED(executorMutex_);

    absl::Status UpdateExecutorSettings(const litert::lm::LlmExecutorSettings& executorSettings)
        ABSL_LOCKS_EXCLUDED(executorMutex_);

private:
    explicit TextResourceManager(std::unique_ptr<litert::lm::LlmExecutor> llmExecutor);

    absl::Mutex executorMutex_;
    std::shared_ptr<litert::lm::LlmExecutor> llmExecutor_ ABSL_GUARDED_BY(executorMutex_);
    std::shared_ptr<litert::lm::ContextHandler> currentHandler_ ABSL_GUARDED_BY(executorMutex_);
};

}
