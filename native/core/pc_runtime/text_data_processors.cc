#include "pc_runtime/text_data_processors.h"

#include <cstddef>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <variant>
#include <vector>

#include "absl/log/absl_log.h"
#include "absl/status/status.h"
#include "absl/status/status_macros.h"
#include "absl/status/statusor.h"
#include "absl/strings/string_view.h"
#include "nlohmann/json.hpp"
#include "runtime/components/tool_use/parser_utils.h"
#include "runtime/components/tool_use/python_tool_format_utils.h"
#include "runtime/conversation/model_data_processor/data_utils.h"
#include "runtime/conversation/prompt_utils.h"
#include "sentencepiece_model.pb.h"
#include "support/tokenizer/sentencepiece_tokenizer.h"

namespace eversoul::pc_runtime {
namespace {

using litert::lm::Constraint;
using litert::lm::InputData;
using litert::lm::InputText;
using litert::lm::JsonPreface;
using litert::lm::Message;
using litert::lm::Preface;
using litert::lm::PromptTemplate;
using litert::lm::PromptTemplateInput;
using litert::lm::Responses;
using nlohmann::ordered_json;

bool HasToolCalls(const ordered_json& message) {
    return message.contains("tool_calls") && message["tool_calls"].is_array();
}

bool IsToolMessage(const ordered_json& message) {
    return message.contains("role") && message["role"] == "tool";
}

bool HasTools(const std::optional<Preface>& preface) {
    return preface.has_value() && std::holds_alternative<JsonPreface>(*preface)
        && !std::get<JsonPreface>(*preface).tools.empty();
}

absl::StatusOr<std::string> FormatToolResponse(const ordered_json& toolResponse) {
    if (toolResponse.contains("tool_response")) return litert::lm::FormatValueAsPython(toolResponse["tool_response"]);
    if (toolResponse.contains("response")) return litert::lm::FormatValueAsPython(toolResponse["response"]);
    return litert::lm::FormatValueAsPython(toolResponse);
}

absl::StatusOr<Message> AssistantMessageWithToolCalls(
    const Responses& responses,
    const std::optional<Preface>& preface,
    absl::string_view codeFenceStart,
    absl::string_view codeFenceEnd,
    litert::lm::SyntaxType syntaxType,
    litert::lm::ParserOptions options) {
    absl::string_view responseText = responses.GetTexts()[0];
    ordered_json message = {{"role", "assistant"}};
    if (!HasTools(preface)) {
        message["content"] = ordered_json::array({{{"type", "text"}, {"text", std::string(responseText)}}});
        return message;
    }
    ABSL_ASSIGN_OR_RETURN(
        ordered_json parsed,
        litert::lm::ParseTextAndToolCalls(responseText, codeFenceStart, codeFenceEnd, syntaxType, options));
    if (parsed.contains("content")) message["content"] = parsed["content"];
    if (parsed.contains("tool_calls")) message["tool_calls"] = parsed["tool_calls"];
    return message;
}

absl::StatusOr<std::unique_ptr<Constraint>> CreateGemmaConstraint(
    const GemmaConstraintProviderHandle& provider,
    const ordered_json& tools,
    const LiteRtLmGemmaModelConstraintOptions& options) {
    if (provider == nullptr) {
        return std::unique_ptr<Constraint>();
    }
    if (!tools.is_array()) {
        return absl::InvalidArgumentError("Tools must be an array.");
    }
    ordered_json functions = ordered_json::array();
    for (const auto& tool : tools) {
        functions.push_back(tool.contains("function") ? tool["function"] : tool);
    }
    const std::string serializedFunctions = functions.dump();
    LiteRtLmConstraint* constraint = LiteRtLmGemmaModelConstraintProvider_CreateConstraintFromTools(
        provider.get(), serializedFunctions.c_str(), &options);
    if (constraint == nullptr) {
        return absl::InternalError("Failed to create constraint with tools.");
    }
    return std::unique_ptr<Constraint>(reinterpret_cast<Constraint*>(constraint));
}

}

absl::StatusOr<std::vector<InputData>> TextOnlyInputData(
    const std::string& renderedPrompt, const ordered_json& messages) {
    for (const auto& message : messages) {
        if (!message.contains("content") || !message["content"].is_array()) continue;
        for (const auto& item : message["content"]) {
            if (item.is_object() && item.contains("type") && item["type"] != "text") {
                return absl::InvalidArgumentError("pc_text_runtime_rejects_multimodal_message_content");
            }
        }
    }
    std::vector<InputData> inputs;
    if (!renderedPrompt.empty()) {
        inputs.emplace_back(InputText(renderedPrompt));
    }
    return inputs;
}

absl::StatusOr<GemmaConstraintProviderHandle> CreateGemmaConstraintProvider(
    const litert::support::Tokenizer* tokenizer,
    const std::vector<std::vector<int>>& stopTokenIds,
    bool enableConstrainedDecoding) {
    GemmaConstraintProviderHandle provider(nullptr, &LiteRtLmGemmaModelConstraintProvider_Destroy);
    if (!enableConstrainedDecoding) {
        return provider;
    }
    if (tokenizer == nullptr || tokenizer->GetTokenizerType() != litert::support::TokenizerType::kSentencePiece) {
        ABSL_LOG(WARNING) << "Constrained decoding is only supported for SentencePiece tokenizer.";
        return provider;
    }
    std::vector<const int*> stopTokenPointers;
    std::vector<size_t> stopTokenLengths;
    stopTokenPointers.reserve(stopTokenIds.size());
    stopTokenLengths.reserve(stopTokenIds.size());
    for (const auto& stopTokens : stopTokenIds) {
        stopTokenPointers.push_back(stopTokens.data());
        stopTokenLengths.push_back(stopTokens.size());
    }
    const auto* sentencePieceTokenizer = reinterpret_cast<const litert::support::SentencePieceTokenizer*>(tokenizer);
    const std::string serializedModel = sentencePieceTokenizer->GetProcessor().model_proto().SerializeAsString();
    LiteRtLmGemmaModelConstraintProvider* created = LiteRtLmGemmaModelConstraintProvider_Create(
        serializedModel.data(), serializedModel.size(), stopTokenPointers.data(), stopTokenLengths.data(),
        stopTokenIds.size());
    if (created == nullptr) {
        return absl::InternalError("Failed to create GemmaModelConstraintProvider.");
    }
    provider.reset(created);
    return provider;
}

Gemma3TextDataProcessor::Gemma3TextDataProcessor(
    GemmaConstraintProviderHandle constraintProvider,
    litert::lm::Gemma3DataProcessorConfig config,
    std::optional<Preface> preface)
    : constraintProvider_(std::move(constraintProvider)), config_(std::move(config)), preface_(std::move(preface)) {}

absl::StatusOr<std::unique_ptr<Gemma3TextDataProcessor>> Gemma3TextDataProcessor::Create(
    litert::lm::Gemma3DataProcessorConfig config,
    std::optional<Preface> preface,
    const litert::support::Tokenizer* tokenizer,
    const std::vector<std::vector<int>>& stopTokenIds,
    bool enableConstrainedDecoding) {
    ABSL_ASSIGN_OR_RETURN(
        auto provider, CreateGemmaConstraintProvider(tokenizer, stopTokenIds, enableConstrainedDecoding));
    return std::unique_ptr<Gemma3TextDataProcessor>(
        new Gemma3TextDataProcessor(std::move(provider), std::move(config), std::move(preface)));
}

absl::StatusOr<ordered_json> Gemma3TextDataProcessor::MessageToTemplateInput(const ordered_json& message) const {
    if (!HasToolCalls(message) && !IsToolMessage(message)) {
        return ModelDataProcessor::MessageToTemplateInput(message);
    }
    ordered_json templateInput = ordered_json::object();
    if (message.contains("role")) templateInput["role"] = message["role"];
    if (message.contains("content")) {
        if (IsToolMessage(message) && message["content"].is_array()) {
            templateInput["content"] = ordered_json::array();
            for (const auto& item : message["content"]) {
                ABSL_ASSIGN_OR_RETURN(std::string formatted, FormatToolResponse(item));
                templateInput["content"].push_back({{"type", "text"}, {"text", formatted}});
            }
        }
        else if (IsToolMessage(message) && message["content"].is_object()) {
            ABSL_ASSIGN_OR_RETURN(std::string formatted, FormatToolResponse(message["content"]));
            templateInput["content"] = ordered_json::array({{{"type", "text"}, {"text", std::move(formatted)}}});
        }
        else {
            templateInput["content"] = litert::lm::NormalizeContent(message["content"]);
        }
    }
    if (message.contains("tool_calls")) {
        templateInput["tool_calls"] = ordered_json::array();
        for (const auto& toolCall : message["tool_calls"]) {
            if (!toolCall.contains("function")) continue;
            const ordered_json& function = toolCall["function"];
            ordered_json callInput = ordered_json::object();
            callInput["type"] = "function";
            callInput["function"]["name"] = function["name"];
            if (function.contains("arguments")) {
                if (function["arguments"].is_object()) {
                    for (const auto& [key, value] : function["arguments"].items()) {
                        ABSL_ASSIGN_OR_RETURN(std::string formatted, litert::lm::FormatValueAsPython(value));
                        callInput["function"]["arguments"][key] = formatted;
                    }
                }
                else {
                    callInput["function"]["arguments"] = function["arguments"];
                }
            }
            templateInput["tool_calls"].push_back(callInput);
        }
    }
    return templateInput;
}

absl::StatusOr<ordered_json> Gemma3TextDataProcessor::FormatTools(const ordered_json& tools) const {
    if (!tools.is_array()) {
        return absl::InvalidArgumentError("Tools must be an array.");
    }
    ordered_json formatted = ordered_json::array();
    for (const auto& tool : tools) {
        ABSL_ASSIGN_OR_RETURN(std::string formattedTool, litert::lm::FormatToolAsPython(tool));
        formatted.push_back(formattedTool);
    }
    return formatted;
}

absl::StatusOr<std::unique_ptr<Constraint>> Gemma3TextDataProcessor::CreateConstraint(const ordered_json& tools) const {
    const LiteRtLmGemmaModelConstraintOptions options = {
        .funcall_format = kLiteRtLmGemmaFuncallFormatPythonStyle,
        .code_fence_start = config_.code_fence_start.c_str(),
        .code_fence_end = config_.code_fence_end.c_str(),
        .open_quote = nullptr,
        .close_quote = nullptr,
        .function_response_start = nullptr};
    return CreateGemmaConstraint(constraintProvider_, tools, options);
}

absl::StatusOr<litert::lm::ModelDataProcessor::SingleTurnTemplateRenderResult>
Gemma3TextDataProcessor::RenderSingleTurnTemplate(
    std::vector<Message>& history,
    const Preface& preface,
    const Message& message,
    const PromptTemplate& promptTemplate,
    bool currentIsAppendingMessage,
    bool appendMessage,
    std::optional<ordered_json> extraContext) const {
    return litert::lm::RenderSingleTurnTemplateCommon(
        *this, history, preface, message, promptTemplate, currentIsAppendingMessage, appendMessage,
        std::move(extraContext), true);
}

absl::StatusOr<std::vector<InputData>> Gemma3TextDataProcessor::ToInputDataVectorImpl(
    const std::string& renderedPrompt,
    const ordered_json& messages,
    const litert::lm::Gemma3DataProcessorArguments&) const {
    return TextOnlyInputData(renderedPrompt, messages);
}

absl::StatusOr<Message> Gemma3TextDataProcessor::ToMessageImpl(
    const Responses& responses, const litert::lm::Gemma3DataProcessorArguments&) const {
    return AssistantMessageWithToolCalls(
        responses, preface_, config_.code_fence_start, config_.code_fence_end,
        litert::lm::GetSyntaxType(config_.syntax_type),
        {.escape_fence_strings = config_.escape_fence_strings,
         .tool_code_regex = config_.tool_code_regex,
         .return_error_on_parse_failure = ReturnErrorOnParseFailure()});
}

Gemma4TextDataProcessor::Gemma4TextDataProcessor(
    GemmaConstraintProviderHandle constraintProvider,
    litert::lm::Gemma4DataProcessorConfig config,
    std::optional<Preface> preface)
    : constraintProvider_(std::move(constraintProvider)), config_(std::move(config)), preface_(std::move(preface)) {}

absl::StatusOr<std::unique_ptr<Gemma4TextDataProcessor>> Gemma4TextDataProcessor::Create(
    litert::lm::Gemma4DataProcessorConfig config,
    std::optional<Preface> preface,
    const litert::support::Tokenizer* tokenizer,
    const std::vector<std::vector<int>>& stopTokenIds,
    bool enableConstrainedDecoding) {
    ABSL_ASSIGN_OR_RETURN(
        auto provider, CreateGemmaConstraintProvider(tokenizer, stopTokenIds, enableConstrainedDecoding));
    return std::unique_ptr<Gemma4TextDataProcessor>(
        new Gemma4TextDataProcessor(std::move(provider), std::move(config), std::move(preface)));
}

absl::StatusOr<std::unique_ptr<Constraint>> Gemma4TextDataProcessor::CreateConstraint(const ordered_json& tools) const {
    LiteRtLmGemmaModelConstraintOptions options = {
        .funcall_format = kLiteRtLmGemmaFuncallFormatFcStyle,
        .code_fence_start = config_.code_fence_start.c_str(),
        .code_fence_end = config_.code_fence_end.c_str(),
        .open_quote = config_.open_quote.c_str(),
        .close_quote = config_.close_quote.c_str(),
        .function_response_start = config_.function_response_start.c_str()};
    options.constraint_mode =
        config_.constraint_mode == litert::lm::Gemma4DataProcessorConfig::ConstraintMode::kFunctionCallOnly
        ? kLiteRtLmGemmaConstraintModeFunctionCallOnly
        : kLiteRtLmGemmaConstraintModeTextAndOr;
    return CreateGemmaConstraint(constraintProvider_, tools, options);
}

absl::StatusOr<litert::lm::ModelDataProcessor::SingleTurnTemplateRenderResult>
Gemma4TextDataProcessor::RenderSingleTurnTemplate(
    std::vector<Message>& history,
    const Preface& preface,
    const Message& message,
    const PromptTemplate& promptTemplate,
    bool currentIsAppendingMessage,
    bool appendMessage,
    std::optional<ordered_json> extraContext) const {
    return litert::lm::RenderSingleTurnTemplateCommon(
        *this, history, preface, message, promptTemplate, currentIsAppendingMessage, appendMessage,
        std::move(extraContext), false);
}

absl::StatusOr<std::vector<InputData>> Gemma4TextDataProcessor::ToInputDataVectorImpl(
    const std::string& renderedPrompt,
    const ordered_json& messages,
    const litert::lm::Gemma4DataProcessorArguments& arguments) const {
    if (arguments.visual_token_budget.has_value()) {
        return absl::InvalidArgumentError("pc_text_runtime_rejects_visual_token_budget");
    }
    return TextOnlyInputData(renderedPrompt, messages);
}

absl::StatusOr<Message> Gemma4TextDataProcessor::ToMessageImpl(
    const Responses& responses, const litert::lm::Gemma4DataProcessorArguments&) const {
    return AssistantMessageWithToolCalls(
        responses, preface_, config_.code_fence_start, config_.code_fence_end,
        litert::lm::GetSyntaxType(config_.syntax_type),
        {.escape_fence_strings = config_.escape_fence_strings,
         .tool_code_regex = config_.tool_code_regex,
         .return_error_on_parse_failure = ReturnErrorOnParseFailure()});
}

Lfm2TextDataProcessor::Lfm2TextDataProcessor(litert::lm::Lfm2DataProcessorConfig config, std::optional<Preface> preface)
    : config_(std::move(config)), preface_(std::move(preface)) {}

absl::StatusOr<std::unique_ptr<Lfm2TextDataProcessor>> Lfm2TextDataProcessor::Create(
    litert::lm::Lfm2DataProcessorConfig config, std::optional<Preface> preface, bool enableConstrainedDecoding) {
    if (enableConstrainedDecoding) {
        return absl::FailedPreconditionError("Constrained decoding is not supported for Lfm2DataProcessor.");
    }
    return std::unique_ptr<Lfm2TextDataProcessor>(new Lfm2TextDataProcessor(std::move(config), std::move(preface)));
}

absl::StatusOr<ordered_json> Lfm2TextDataProcessor::FormatTools(const ordered_json& tools) const {
    if (!tools.is_array()) {
        return absl::InvalidArgumentError("Tools must be an array.");
    }
    return tools;
}

absl::StatusOr<std::unique_ptr<Constraint>> Lfm2TextDataProcessor::CreateConstraint(const ordered_json&) const {
    return absl::FailedPreconditionError("Constrained decoding is not supported for Lfm2DataProcessor.");
}

absl::StatusOr<std::vector<InputData>> Lfm2TextDataProcessor::ToInputDataVectorImpl(
    const std::string& renderedPrompt,
    const ordered_json& messages,
    const litert::lm::Lfm2DataProcessorArguments&) const {
    return TextOnlyInputData(renderedPrompt, messages);
}

absl::StatusOr<Message> Lfm2TextDataProcessor::ToMessageImpl(
    const Responses& responses, const litert::lm::Lfm2DataProcessorArguments&) const {
    return AssistantMessageWithToolCalls(
        responses, preface_, config_.code_fence_start, config_.code_fence_end, litert::lm::SyntaxType::kPython,
        {.escape_fence_strings = config_.escape_fence_strings,
         .return_error_on_parse_failure = ReturnErrorOnParseFailure()});
}

absl::StatusOr<litert::lm::ModelDataProcessor::SingleTurnTemplateRenderResult>
Lfm2TextDataProcessor::RenderSingleTurnTemplate(
    std::vector<Message>& history,
    const Preface& preface,
    const Message& message,
    const PromptTemplate& promptTemplate,
    bool currentIsAppendingMessage,
    bool appendMessage,
    std::optional<ordered_json> extraContext) const {
    const auto& jsonPreface = std::get<JsonPreface>(preface);
    std::string prefillText;
    const bool isFirstPart = !currentIsAppendingMessage;
    const bool isLastPart = !appendMessage;
    bool nextIsAppendingMessage = currentIsAppendingMessage;
    if (isFirstPart) nextIsAppendingMessage = true;
    if (isLastPart) nextIsAppendingMessage = false;
    bool isRoleChanged = false;
    if (!history.empty()) {
        const auto& lastMessage = history.back();
        if (currentIsAppendingMessage && lastMessage["role"] != message["role"] && lastMessage["role"] != "system") {
            isRoleChanged = true;
            PromptTemplateInput closingInput;
            const ordered_json closingMessage = {{"role", lastMessage["role"]}, {"content", ""}};
            ABSL_ASSIGN_OR_RETURN(ordered_json closingTemplateMessage, MessageToTemplateInput(closingMessage));
            closingInput.extra_context["message"] = closingTemplateMessage;
            closingInput.extra_context["is_appending_to_prefill"] = true;
            closingInput.extra_context["is_first_part"] = false;
            closingInput.extra_context["is_last_part"] = true;
            closingInput.add_generation_prompt = false;
            ABSL_ASSIGN_OR_RETURN(std::string closingText, promptTemplate.Apply(closingInput));
            prefillText += closingText;
        }
    }
    else if (!jsonPreface.messages.empty() || !jsonPreface.tools.empty() || !jsonPreface.extra_context.is_null()) {
        PromptTemplateInput prefaceInput;
        prefaceInput.messages.push_back(
            Message{{"role", "user"}, {"content", ordered_json::array({{{"type", "text"}, {"text", ""}}})}});
        prefaceInput.add_generation_prompt = false;
        if (extraContext.has_value()) {
            for (const auto& [key, value] : extraContext->items()) prefaceInput.extra_context[key] = value;
        }
        ABSL_ASSIGN_OR_RETURN(std::string prefaceText, promptTemplate.Apply(prefaceInput));
        prefillText += prefaceText;
    }
    if (message.is_object()) {
        PromptTemplateInput messageInput;
        ABSL_ASSIGN_OR_RETURN(messageInput.extra_context["message"], MessageToTemplateInput(message));
        messageInput.extra_context["is_appending_to_prefill"] = true;
        messageInput.extra_context["is_first_part"] = isFirstPart || isRoleChanged;
        messageInput.extra_context["is_last_part"] = isLastPart;
        messageInput.add_generation_prompt = !nextIsAppendingMessage;
        if (extraContext.has_value()) {
            for (const auto& [key, value] : extraContext->items()) messageInput.extra_context[key] = value;
        }
        ABSL_ASSIGN_OR_RETURN(std::string messageText, promptTemplate.Apply(messageInput));
        prefillText += messageText;
    }
    return SingleTurnTemplateRenderResult{prefillText, nextIsAppendingMessage};
}

FastVlmTextDataProcessor::FastVlmTextDataProcessor(litert::lm::FastVlmDataProcessorConfig config)
    : config_(std::move(config)) {}

absl::StatusOr<std::unique_ptr<FastVlmTextDataProcessor>> FastVlmTextDataProcessor::Create(
    litert::lm::FastVlmDataProcessorConfig config) {
    return std::unique_ptr<FastVlmTextDataProcessor>(new FastVlmTextDataProcessor(std::move(config)));
}

absl::StatusOr<std::vector<InputData>> FastVlmTextDataProcessor::ToInputDataVectorImpl(
    const std::string& renderedPrompt,
    const ordered_json& messages,
    const litert::lm::FastVlmDataProcessorArguments&) const {
    return TextOnlyInputData(renderedPrompt, messages);
}

absl::StatusOr<Message> FastVlmTextDataProcessor::ToMessageImpl(
    const Responses& responses, const litert::lm::FastVlmDataProcessorArguments&) const {
    const ordered_json content =
        ordered_json::array({{{"type", "text"}, {"text", std::string(responses.GetTexts()[0])}}});
    return ordered_json::object({{"role", "assistant"}, {"content", content}});
}

GenericTextDataProcessor::GenericTextDataProcessor(litert::lm::GenericDataProcessorConfig config)
    : config_(std::move(config)) {}

absl::StatusOr<std::unique_ptr<GenericTextDataProcessor>> GenericTextDataProcessor::Create(
    litert::lm::GenericDataProcessorConfig config) {
    if (config.multimodal.has_value()) {
        return absl::InvalidArgumentError("pc_text_runtime_rejects_multimodal_generic_model");
    }
    return std::unique_ptr<GenericTextDataProcessor>(new GenericTextDataProcessor(std::move(config)));
}

absl::StatusOr<std::vector<InputData>> GenericTextDataProcessor::ToInputDataVectorImpl(
    const std::string& renderedPrompt,
    const ordered_json& messages,
    const litert::lm::GenericDataProcessorArguments& arguments) const {
    if (arguments.visual_token_budget.has_value()) {
        return absl::InvalidArgumentError("pc_text_runtime_rejects_visual_token_budget");
    }
    return TextOnlyInputData(renderedPrompt, messages);
}

absl::StatusOr<Message> GenericTextDataProcessor::ToMessageImpl(
    const Responses& responses, const litert::lm::GenericDataProcessorArguments&) const {
    const absl::string_view responseText = responses.GetTexts()[0];
    ordered_json content = config_.force_string_content
        ? ordered_json(std::string(responseText))
        : ordered_json::array({{{"type", "text"}, {"text", std::string(responseText)}}});
    return ordered_json::object({{"role", config_.model_role}, {"content", std::move(content)}});
}

absl::StatusOr<litert::lm::ModelDataProcessor::SingleTurnTemplateRenderResult>
GenericTextDataProcessor::RenderSingleTurnTemplate(
    std::vector<Message>& history,
    const Preface& preface,
    const Message& message,
    const PromptTemplate& promptTemplate,
    bool currentIsAppendingMessage,
    bool appendMessage,
    std::optional<ordered_json> extraContext) const {
    return litert::lm::RenderSingleTurnTemplateCommon(
        *this, history, preface, message, promptTemplate, currentIsAppendingMessage, appendMessage,
        std::move(extraContext), false);
}

}
