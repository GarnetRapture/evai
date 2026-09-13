#pragma once

#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "absl/status/status.h"
#include "absl/status/statusor.h"
#include "absl/strings/string_view.h"
#include "nlohmann/json.hpp"
#include "runtime/components/constrained_decoding/constraint.h"
#include "runtime/components/constrained_decoding/gemma_model_constraint_provider.h"
#include "runtime/components/prompt_template.h"
#include "runtime/conversation/io_types.h"
#include "runtime/conversation/model_data_processor/config_registry.h"
#include "runtime/conversation/model_data_processor/model_data_processor.h"
#include "runtime/engine/io_types.h"
#include "support/tokenizer/tokenizer.h"

namespace eversoul::pc_runtime {

using GemmaConstraintProviderHandle = std::unique_ptr<
    LiteRtLmGemmaModelConstraintProvider, decltype(&LiteRtLmGemmaModelConstraintProvider_Destroy)>;

absl::StatusOr<std::vector<litert::lm::InputData>> TextOnlyInputData(
    const std::string& renderedPrompt, const nlohmann::ordered_json& messages);

absl::StatusOr<GemmaConstraintProviderHandle> CreateGemmaConstraintProvider(
    const litert::support::Tokenizer* tokenizer,
    const std::vector<std::vector<int>>& stopTokenIds,
    bool enableConstrainedDecoding);

class Gemma3TextDataProcessor final
    : public litert::lm::TypeSafeModelDataProcessor<
          litert::lm::Gemma3DataProcessorConfig, litert::lm::Gemma3DataProcessorArguments> {
public:
    static absl::StatusOr<std::unique_ptr<Gemma3TextDataProcessor>> Create(
        litert::lm::Gemma3DataProcessorConfig config,
        std::optional<litert::lm::Preface> preface,
        const litert::support::Tokenizer* tokenizer,
        const std::vector<std::vector<int>>& stopTokenIds,
        bool enableConstrainedDecoding);

    const litert::lm::Gemma3DataProcessorConfig& GetConfig() const override { return config_; }
    absl::StatusOr<nlohmann::ordered_json> MessageToTemplateInput(const nlohmann::ordered_json& message) const override;
    absl::StatusOr<nlohmann::ordered_json> FormatTools(const nlohmann::ordered_json& tools) const override;
    absl::StatusOr<std::unique_ptr<litert::lm::Constraint>> CreateConstraint(
        const nlohmann::ordered_json& tools) const override;
    absl::string_view CodeFenceStart() const override { return config_.code_fence_start; }
    absl::string_view CodeFenceEnd() const override { return config_.code_fence_end; }
    absl::StatusOr<SingleTurnTemplateRenderResult> RenderSingleTurnTemplate(
        std::vector<litert::lm::Message>& history,
        const litert::lm::Preface& preface,
        const litert::lm::Message& message,
        const litert::lm::PromptTemplate& promptTemplate,
        bool currentIsAppendingMessage,
        bool appendMessage,
        std::optional<nlohmann::ordered_json> extraContext) const override;

private:
    Gemma3TextDataProcessor(
        GemmaConstraintProviderHandle constraintProvider,
        litert::lm::Gemma3DataProcessorConfig config,
        std::optional<litert::lm::Preface> preface);

    absl::StatusOr<std::vector<litert::lm::InputData>> ToInputDataVectorImpl(
        const std::string& renderedPrompt,
        const nlohmann::ordered_json& messages,
        const litert::lm::Gemma3DataProcessorArguments& arguments) const override;
    absl::StatusOr<litert::lm::Message> ToMessageImpl(
        const litert::lm::Responses& responses,
        const litert::lm::Gemma3DataProcessorArguments& arguments) const override;
    absl::Status CloneStateImpl(
        const litert::lm::TypeSafeModelDataProcessor<
            litert::lm::Gemma3DataProcessorConfig, litert::lm::Gemma3DataProcessorArguments>& other) override {
        return absl::OkStatus();
    }

    GemmaConstraintProviderHandle constraintProvider_;
    litert::lm::Gemma3DataProcessorConfig config_;
    std::optional<litert::lm::Preface> preface_;
};

class Gemma4TextDataProcessor final
    : public litert::lm::TypeSafeModelDataProcessor<
          litert::lm::Gemma4DataProcessorConfig, litert::lm::Gemma4DataProcessorArguments> {
public:
    static absl::StatusOr<std::unique_ptr<Gemma4TextDataProcessor>> Create(
        litert::lm::Gemma4DataProcessorConfig config,
        std::optional<litert::lm::Preface> preface,
        const litert::support::Tokenizer* tokenizer,
        const std::vector<std::vector<int>>& stopTokenIds,
        bool enableConstrainedDecoding);

    const litert::lm::Gemma4DataProcessorConfig& GetConfig() const override { return config_; }
    absl::StatusOr<nlohmann::ordered_json> FormatTools(const nlohmann::ordered_json& tools) const override {
        return tools;
    }
    absl::StatusOr<std::unique_ptr<litert::lm::Constraint>> CreateConstraint(
        const nlohmann::ordered_json& tools) const override;
    absl::string_view CodeFenceStart() const override { return config_.code_fence_start; }
    absl::string_view CodeFenceEnd() const override { return config_.code_fence_end; }
    absl::StatusOr<SingleTurnTemplateRenderResult> RenderSingleTurnTemplate(
        std::vector<litert::lm::Message>& history,
        const litert::lm::Preface& preface,
        const litert::lm::Message& message,
        const litert::lm::PromptTemplate& promptTemplate,
        bool currentIsAppendingMessage,
        bool appendMessage,
        std::optional<nlohmann::ordered_json> extraContext) const override;

private:
    Gemma4TextDataProcessor(
        GemmaConstraintProviderHandle constraintProvider,
        litert::lm::Gemma4DataProcessorConfig config,
        std::optional<litert::lm::Preface> preface);

    absl::StatusOr<std::vector<litert::lm::InputData>> ToInputDataVectorImpl(
        const std::string& renderedPrompt,
        const nlohmann::ordered_json& messages,
        const litert::lm::Gemma4DataProcessorArguments& arguments) const override;
    absl::StatusOr<litert::lm::Message> ToMessageImpl(
        const litert::lm::Responses& responses,
        const litert::lm::Gemma4DataProcessorArguments& arguments) const override;
    absl::Status CloneStateImpl(
        const litert::lm::TypeSafeModelDataProcessor<
            litert::lm::Gemma4DataProcessorConfig, litert::lm::Gemma4DataProcessorArguments>& other) override {
        return absl::OkStatus();
    }

    GemmaConstraintProviderHandle constraintProvider_;
    litert::lm::Gemma4DataProcessorConfig config_;
    std::optional<litert::lm::Preface> preface_;
};

class Lfm2TextDataProcessor final
    : public litert::lm::TypeSafeModelDataProcessor<
          litert::lm::Lfm2DataProcessorConfig, litert::lm::Lfm2DataProcessorArguments> {
public:
    static absl::StatusOr<std::unique_ptr<Lfm2TextDataProcessor>> Create(
        litert::lm::Lfm2DataProcessorConfig config,
        std::optional<litert::lm::Preface> preface,
        bool enableConstrainedDecoding);

    const litert::lm::Lfm2DataProcessorConfig& GetConfig() const override { return config_; }
    absl::StatusOr<nlohmann::ordered_json> FormatTools(const nlohmann::ordered_json& tools) const override;
    absl::StatusOr<std::unique_ptr<litert::lm::Constraint>> CreateConstraint(
        const nlohmann::ordered_json& tools) const override;
    absl::string_view CodeFenceStart() const override { return config_.code_fence_start; }
    absl::string_view CodeFenceEnd() const override { return config_.code_fence_end; }
    absl::StatusOr<SingleTurnTemplateRenderResult> RenderSingleTurnTemplate(
        std::vector<litert::lm::Message>& history,
        const litert::lm::Preface& preface,
        const litert::lm::Message& message,
        const litert::lm::PromptTemplate& promptTemplate,
        bool currentIsAppendingMessage,
        bool appendMessage,
        std::optional<nlohmann::ordered_json> extraContext) const override;

private:
    Lfm2TextDataProcessor(litert::lm::Lfm2DataProcessorConfig config, std::optional<litert::lm::Preface> preface);

    absl::StatusOr<std::vector<litert::lm::InputData>> ToInputDataVectorImpl(
        const std::string& renderedPrompt,
        const nlohmann::ordered_json& messages,
        const litert::lm::Lfm2DataProcessorArguments& arguments) const override;
    absl::StatusOr<litert::lm::Message> ToMessageImpl(
        const litert::lm::Responses& responses,
        const litert::lm::Lfm2DataProcessorArguments& arguments) const override;
    absl::Status CloneStateImpl(
        const litert::lm::TypeSafeModelDataProcessor<
            litert::lm::Lfm2DataProcessorConfig, litert::lm::Lfm2DataProcessorArguments>& other) override {
        return absl::OkStatus();
    }

    litert::lm::Lfm2DataProcessorConfig config_;
    std::optional<litert::lm::Preface> preface_;
};

class FastVlmTextDataProcessor final
    : public litert::lm::TypeSafeModelDataProcessor<
          litert::lm::FastVlmDataProcessorConfig, litert::lm::FastVlmDataProcessorArguments> {
public:
    static absl::StatusOr<std::unique_ptr<FastVlmTextDataProcessor>> Create(
        litert::lm::FastVlmDataProcessorConfig config);

    const litert::lm::FastVlmDataProcessorConfig& GetConfig() const override { return config_; }
    absl::StatusOr<nlohmann::ordered_json> FormatTools(const nlohmann::ordered_json& tools) const override {
        return tools;
    }
    absl::string_view CodeFenceStart() const override { return ""; }
    absl::string_view CodeFenceEnd() const override { return ""; }

private:
    explicit FastVlmTextDataProcessor(litert::lm::FastVlmDataProcessorConfig config);

    absl::StatusOr<std::vector<litert::lm::InputData>> ToInputDataVectorImpl(
        const std::string& renderedPrompt,
        const nlohmann::ordered_json& messages,
        const litert::lm::FastVlmDataProcessorArguments& arguments) const override;
    absl::StatusOr<litert::lm::Message> ToMessageImpl(
        const litert::lm::Responses& responses,
        const litert::lm::FastVlmDataProcessorArguments& arguments) const override;
    absl::Status CloneStateImpl(
        const litert::lm::TypeSafeModelDataProcessor<
            litert::lm::FastVlmDataProcessorConfig, litert::lm::FastVlmDataProcessorArguments>& other) override {
        return absl::OkStatus();
    }

    litert::lm::FastVlmDataProcessorConfig config_;
};

class GenericTextDataProcessor final
    : public litert::lm::TypeSafeModelDataProcessor<
          litert::lm::GenericDataProcessorConfig, litert::lm::GenericDataProcessorArguments> {
public:
    static absl::StatusOr<std::unique_ptr<GenericTextDataProcessor>> Create(
        litert::lm::GenericDataProcessorConfig config);

    const litert::lm::GenericDataProcessorConfig& GetConfig() const override { return config_; }
    absl::StatusOr<nlohmann::ordered_json> FormatTools(const nlohmann::ordered_json& tools) const override {
        return tools;
    }
    absl::string_view CodeFenceStart() const override { return ""; }
    absl::string_view CodeFenceEnd() const override { return ""; }
    absl::StatusOr<SingleTurnTemplateRenderResult> RenderSingleTurnTemplate(
        std::vector<litert::lm::Message>& history,
        const litert::lm::Preface& preface,
        const litert::lm::Message& message,
        const litert::lm::PromptTemplate& promptTemplate,
        bool currentIsAppendingMessage,
        bool appendMessage,
        std::optional<nlohmann::ordered_json> extraContext) const override;

private:
    explicit GenericTextDataProcessor(litert::lm::GenericDataProcessorConfig config);

    absl::StatusOr<std::vector<litert::lm::InputData>> ToInputDataVectorImpl(
        const std::string& renderedPrompt,
        const nlohmann::ordered_json& messages,
        const litert::lm::GenericDataProcessorArguments& arguments) const override;
    absl::StatusOr<litert::lm::Message> ToMessageImpl(
        const litert::lm::Responses& responses,
        const litert::lm::GenericDataProcessorArguments& arguments) const override;
    absl::Status CloneStateImpl(
        const litert::lm::TypeSafeModelDataProcessor<
            litert::lm::GenericDataProcessorConfig, litert::lm::GenericDataProcessorArguments>& other) override {
        return absl::OkStatus();
    }

    litert::lm::GenericDataProcessorConfig config_;
};

}
