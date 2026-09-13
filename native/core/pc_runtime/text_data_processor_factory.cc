#include <memory>
#include <optional>
#include <string>
#include <variant>
#include <vector>

#include "absl/status/status.h"
#include "absl/status/status_macros.h"
#include "absl/status/statusor.h"
#include "pc_runtime/text_data_processors.h"
#include "runtime/components/prompt_template.h"
#include "runtime/conversation/io_types.h"
#include "runtime/conversation/model_data_processor/config_registry.h"
#include "runtime/conversation/model_data_processor/function_gemma_data_processor.h"
#include "runtime/conversation/model_data_processor/minicpm5_data_processor.h"
#include "runtime/conversation/model_data_processor/model_data_processor.h"
#include "runtime/conversation/model_data_processor/model_data_processor_factory.h"
#include "runtime/conversation/model_data_processor/qwen3_data_processor.h"
#include "runtime/proto/llm_model_type.pb.h"
#include "runtime/proto/token.pb.h"

namespace litert::lm {
namespace {

absl::StatusOr<std::string> TokenString(const proto::TokenUnion& tokenUnion) {
    if (!tokenUnion.has_token_str()) {
        return absl::InvalidArgumentError("token_str field is not set in TokenUnion.");
    }
    return tokenUnion.token_str();
}

absl::StatusOr<DataProcessorConfig> Gemma3Config(const proto::LlmModelType& modelType) {
    Gemma3DataProcessorConfig config;
    if (modelType.has_gemma3n()) {
        const proto::Gemma3N& gemma = modelType.gemma3n();
        if (gemma.has_start_of_image_token()) {
            ABSL_ASSIGN_OR_RETURN(config.boi_token, TokenString(gemma.start_of_image_token()));
        }
        if (gemma.has_end_of_image_token()) {
            ABSL_ASSIGN_OR_RETURN(config.eoi_token, TokenString(gemma.end_of_image_token()));
        }
        if (gemma.has_start_of_audio_token()) {
            ABSL_ASSIGN_OR_RETURN(config.boa_token, TokenString(gemma.start_of_audio_token()));
        }
        if (gemma.has_end_of_audio_token()) {
            ABSL_ASSIGN_OR_RETURN(config.eoa_token, TokenString(gemma.end_of_audio_token()));
        }
        const auto& defaults = proto::Gemma3N::default_instance();
        if (gemma.image_tensor_height() != defaults.image_tensor_height()) config.image_tensor_height = gemma.image_tensor_height();
        if (gemma.image_tensor_width() != defaults.image_tensor_width()) config.image_tensor_width = gemma.image_tensor_width();
    }
    else if (modelType.has_gemma3()) {
        const proto::Gemma3& gemma = modelType.gemma3();
        if (gemma.has_start_of_image_token()) {
            ABSL_ASSIGN_OR_RETURN(config.boi_token, TokenString(gemma.start_of_image_token()));
        }
        if (gemma.has_end_of_image_token()) {
            ABSL_ASSIGN_OR_RETURN(config.eoi_token, TokenString(gemma.end_of_image_token()));
        }
        const auto& defaults = proto::Gemma3::default_instance();
        if (gemma.image_tensor_height() != defaults.image_tensor_height()) config.image_tensor_height = gemma.image_tensor_height();
        if (gemma.image_tensor_width() != defaults.image_tensor_width()) config.image_tensor_width = gemma.image_tensor_width();
    }
    else {
        return absl::InvalidArgumentError(
            "Gemma3N or Gemma3 LlmModelType is required to create Gemma3DataProcessorConfig.");
    }
    return config;
}

absl::StatusOr<DataProcessorConfig> FunctionGemmaConfig(const proto::LlmModelType& modelType) {
    if (!modelType.has_function_gemma()) {
        return absl::InvalidArgumentError(
            "FunctionGemma LlmModelType is required to create FunctionGemmaDataProcessorConfig.");
    }
    FunctionGemmaDataProcessorConfig config;
    const proto::FunctionGemma& gemma = modelType.function_gemma();
    const auto& defaults = proto::FunctionGemma::default_instance();
    if (gemma.code_fence_start() != defaults.code_fence_start()) config.code_fence_start = gemma.code_fence_start();
    if (gemma.code_fence_end() != defaults.code_fence_end()) config.code_fence_end = gemma.code_fence_end();
    if (gemma.syntax_type() != defaults.syntax_type()) config.syntax_type = gemma.syntax_type();
    if (gemma.escape_fence_strings() != defaults.escape_fence_strings()) config.escape_fence_strings = gemma.escape_fence_strings();
    if (gemma.tool_code_regex() != defaults.tool_code_regex()) config.tool_code_regex = gemma.tool_code_regex();
    if (gemma.use_template_for_fc_format() != defaults.use_template_for_fc_format()) {
        config.use_template_for_fc_format = gemma.use_template_for_fc_format();
    }
    if (gemma.constraint_mode() != defaults.constraint_mode()) {
        config.constraint_mode = gemma.constraint_mode() == proto::CONSTRAINT_MODE_FUNCTION_CALL_ONLY
            ? FunctionGemmaDataProcessorConfig::ConstraintMode::kFunctionCallOnly
            : FunctionGemmaDataProcessorConfig::ConstraintMode::kTextAndOr;
    }
    return config;
}

absl::StatusOr<DataProcessorConfig> Gemma4Config(const proto::LlmModelType& modelType) {
    if (!modelType.has_gemma4()) {
        return absl::InvalidArgumentError("Gemma4 LlmModelType is required to create Gemma4DataProcessorConfig.");
    }
    Gemma4DataProcessorConfig config;
    const proto::Gemma4& gemma = modelType.gemma4();
    if (gemma.has_start_of_image_token()) {
        ABSL_ASSIGN_OR_RETURN(config.boi_token, TokenString(gemma.start_of_image_token()));
    }
    if (gemma.has_end_of_image_token()) {
        ABSL_ASSIGN_OR_RETURN(config.eoi_token, TokenString(gemma.end_of_image_token()));
    }
    if (gemma.has_start_of_audio_token()) {
        ABSL_ASSIGN_OR_RETURN(config.boa_token, TokenString(gemma.start_of_audio_token()));
    }
    if (gemma.has_end_of_audio_token()) {
        ABSL_ASSIGN_OR_RETURN(config.eoa_token, TokenString(gemma.end_of_audio_token()));
    }
    const auto& defaults = proto::Gemma4::default_instance();
    if (gemma.code_fence_start() != defaults.code_fence_start()) config.code_fence_start = gemma.code_fence_start();
    if (gemma.code_fence_end() != defaults.code_fence_end()) config.code_fence_end = gemma.code_fence_end();
    if (gemma.syntax_type() != defaults.syntax_type()) config.syntax_type = gemma.syntax_type();
    if (gemma.escape_fence_strings() != defaults.escape_fence_strings()) config.escape_fence_strings = gemma.escape_fence_strings();
    if (gemma.tool_code_regex() != defaults.tool_code_regex()) config.tool_code_regex = gemma.tool_code_regex();
    if (gemma.open_quote() != defaults.open_quote()) config.open_quote = gemma.open_quote();
    if (gemma.close_quote() != defaults.close_quote()) config.close_quote = gemma.close_quote();
    if (gemma.function_response_start() != defaults.function_response_start()) {
        config.function_response_start = gemma.function_response_start();
    }
    if (gemma.constraint_mode() != defaults.constraint_mode()) {
        config.constraint_mode = gemma.constraint_mode() == proto::CONSTRAINT_MODE_FUNCTION_CALL_ONLY
            ? Gemma4DataProcessorConfig::ConstraintMode::kFunctionCallOnly
            : Gemma4DataProcessorConfig::ConstraintMode::kTextAndOr;
    }
    if (gemma.patch_width() != defaults.patch_width()) config.patch_width = gemma.patch_width();
    if (gemma.patch_height() != defaults.patch_height()) config.patch_height = gemma.patch_height();
    if (gemma.max_num_patches() != defaults.max_num_patches()) config.max_num_patches = gemma.max_num_patches();
    if (gemma.pooling_kernel_size() != defaults.pooling_kernel_size()) config.pooling_kernel_size = gemma.pooling_kernel_size();
    if (gemma.merge_patches() != defaults.merge_patches()) config.merge_patches = gemma.merge_patches();
    if (gemma.skip_mel_spectrogram_extraction() != defaults.skip_mel_spectrogram_extraction()) {
        config.skip_mel_spectrogram_extraction = gemma.skip_mel_spectrogram_extraction();
    }
    return config;
}

absl::StatusOr<DataProcessorConfig> FastVlmConfig(const proto::LlmModelType& modelType) {
    if (!modelType.has_fast_vlm()) {
        return absl::InvalidArgumentError("FastVlm LlmModelType is required to create FastVlmDataProcessorConfig.");
    }
    FastVlmDataProcessorConfig config;
    const proto::FastVlm& fastVlm = modelType.fast_vlm();
    const auto& defaults = proto::FastVlm::default_instance();
    if (fastVlm.image_tensor_height() != defaults.image_tensor_height()) config.image_tensor_height = fastVlm.image_tensor_height();
    if (fastVlm.image_tensor_width() != defaults.image_tensor_width()) config.image_tensor_width = fastVlm.image_tensor_width();
    return config;
}

absl::StatusOr<DataProcessorConfig> GenericConfig(const proto::LlmModelType& modelType) {
    if (!modelType.has_generic_model()) {
        return absl::InvalidArgumentError("GenericModel LlmModelType is required to create GenericDataProcessorConfig.");
    }
    const proto::GenericModel& generic = modelType.generic_model();
    if (generic.image_enabled() || generic.audio_enabled()) {
        return absl::InvalidArgumentError("pc_text_runtime_rejects_multimodal_generic_model");
    }
    GenericDataProcessorConfig config;
    if (generic.has_model_role()) config.model_role = generic.model_role();
    if (generic.has_force_string_content()) config.force_string_content = generic.force_string_content();
    return config;
}

absl::StatusOr<DataProcessorConfig> Qwen3Config(const proto::LlmModelType& modelType) {
    if (!modelType.has_qwen3() && !modelType.has_qwen2p5()) {
        return absl::InvalidArgumentError(
            "Qwen3 or Qwen2.5 LlmModelType is required to create Qwen3DataProcessorConfig.");
    }
    Qwen3DataProcessorConfig config;
    if (modelType.has_qwen3()) {
        const auto& qwen = modelType.qwen3();
        if (qwen.has_code_fence_start()) config.code_fence_start = qwen.code_fence_start();
        if (qwen.has_code_fence_end()) config.code_fence_end = qwen.code_fence_end();
        if (qwen.has_escape_fence_strings()) config.escape_fence_strings = qwen.escape_fence_strings();
        if (qwen.has_tool_code_regex()) config.tool_code_regex = qwen.tool_code_regex();
    }
    if (modelType.has_qwen2p5()) {
        const auto& qwen = modelType.qwen2p5();
        if (qwen.has_code_fence_start()) config.code_fence_start = qwen.code_fence_start();
        if (qwen.has_code_fence_end()) config.code_fence_end = qwen.code_fence_end();
        if (qwen.has_escape_fence_strings()) config.escape_fence_strings = qwen.escape_fence_strings();
        if (qwen.has_tool_code_regex()) config.tool_code_regex = qwen.tool_code_regex();
    }
    return config;
}

absl::StatusOr<DataProcessorConfig> Lfm2Config(const proto::LlmModelType& modelType) {
    if (!modelType.has_lfm2()) {
        return absl::InvalidArgumentError("Lfm2 LlmModelType is required to create Lfm2DataProcessorConfig.");
    }
    Lfm2DataProcessorConfig config;
    const proto::Lfm2& lfm2 = modelType.lfm2();
    const auto& defaults = proto::Lfm2::default_instance();
    if (lfm2.has_start_of_image_token()) {
        ABSL_ASSIGN_OR_RETURN(config.boi_token, TokenString(lfm2.start_of_image_token()));
    }
    if (lfm2.has_end_of_image_token()) {
        ABSL_ASSIGN_OR_RETURN(config.eoi_token, TokenString(lfm2.end_of_image_token()));
    }
    if (lfm2.patch_width() != defaults.patch_width()) config.patch_width = lfm2.patch_width();
    if (lfm2.patch_height() != defaults.patch_height()) config.patch_height = lfm2.patch_height();
    if (lfm2.max_num_patches() != defaults.max_num_patches()) config.max_num_patches = lfm2.max_num_patches();
    if (lfm2.pooling_kernel_size() != defaults.pooling_kernel_size()) config.pooling_kernel_size = lfm2.pooling_kernel_size();
    if (lfm2.image_tensor_height() != defaults.image_tensor_height()) config.image_height = lfm2.image_tensor_height();
    if (lfm2.image_tensor_width() != defaults.image_tensor_width()) config.image_width = lfm2.image_tensor_width();
    if (!lfm2.normalization_mean().empty()) {
        config.normalization_mean.assign(lfm2.normalization_mean().begin(), lfm2.normalization_mean().end());
    }
    if (!lfm2.normalization_std().empty()) {
        config.normalization_std.assign(lfm2.normalization_std().begin(), lfm2.normalization_std().end());
    }
    if (lfm2.normalization_rescale_factor() != defaults.normalization_rescale_factor()) {
        config.normalization_rescale_factor = lfm2.normalization_rescale_factor();
    }
    if (lfm2.has_code_fence_start()) config.code_fence_start = lfm2.code_fence_start();
    if (lfm2.has_code_fence_end()) config.code_fence_end = lfm2.code_fence_end();
    if (lfm2.has_escape_fence_strings()) config.escape_fence_strings = lfm2.escape_fence_strings();
    return config;
}

absl::StatusOr<DataProcessorConfig> MiniCpm5Config(const proto::LlmModelType& modelType) {
    if (!modelType.has_minicpm5()) {
        return absl::InvalidArgumentError("MiniCPM5 LlmModelType is required to create MiniCpm5DataProcessorConfig.");
    }
    MiniCpm5DataProcessorConfig config;
    const proto::MiniCPM5& miniCpm = modelType.minicpm5();
    if (miniCpm.has_code_fence_start()) config.code_fence_start = miniCpm.code_fence_start();
    if (miniCpm.has_code_fence_end()) config.code_fence_end = miniCpm.code_fence_end();
    if (miniCpm.has_escape_fence_strings()) config.escape_fence_strings = miniCpm.escape_fence_strings();
    if (miniCpm.has_tool_code_regex()) config.tool_code_regex = miniCpm.tool_code_regex();
    return config;
}

}

absl::StatusOr<DataProcessorConfig> CreateDataProcessorConfigFromLlmModelType(const proto::LlmModelType& modelType) {
    switch (modelType.model_type_case()) {
    case proto::LlmModelType::kGemma3:
    case proto::LlmModelType::kGemma3N:
        return Gemma3Config(modelType);
    case proto::LlmModelType::kLfm2:
        return Lfm2Config(modelType);
    case proto::LlmModelType::kMinicpm5:
        return MiniCpm5Config(modelType);
    case proto::LlmModelType::kGemma4:
        return Gemma4Config(modelType);
    case proto::LlmModelType::kQwen3:
    case proto::LlmModelType::kQwen2P5:
        return Qwen3Config(modelType);
    case proto::LlmModelType::kGenericModel:
        return GenericConfig(modelType);
    case proto::LlmModelType::kFastVlm:
        return FastVlmConfig(modelType);
    case proto::LlmModelType::kFunctionGemma:
        return FunctionGemmaConfig(modelType);
    default:
        return absl::InvalidArgumentError("Unsupported model type");
    }
}

absl::StatusOr<std::unique_ptr<ModelDataProcessor>> CreateModelDataProcessor(
    const DataProcessorConfig& config,
    std::optional<Preface> preface,
    const Tokenizer* tokenizer,
    const std::vector<std::vector<int>>& stopTokenIds,
    bool enableConstrainedDecoding,
    PromptTemplateCapabilities capabilities) {
    if (const auto* gemma3 = std::get_if<Gemma3DataProcessorConfig>(&config)) {
        return eversoul::pc_runtime::Gemma3TextDataProcessor::Create(
            *gemma3, preface, tokenizer, stopTokenIds, enableConstrainedDecoding);
    }
    if (const auto* lfm2 = std::get_if<Lfm2DataProcessorConfig>(&config)) {
        return eversoul::pc_runtime::Lfm2TextDataProcessor::Create(*lfm2, preface, enableConstrainedDecoding);
    }
    if (const auto* miniCpm = std::get_if<MiniCpm5DataProcessorConfig>(&config)) {
        return MiniCpm5DataProcessor::Create(*miniCpm, preface);
    }
    if (const auto* qwen = std::get_if<Qwen3DataProcessorConfig>(&config)) {
        return Qwen3DataProcessor::Create(*qwen, preface);
    }
    if (const auto* generic = std::get_if<GenericDataProcessorConfig>(&config)) {
        return eversoul::pc_runtime::GenericTextDataProcessor::Create(*generic);
    }
    if (const auto* functionGemma = std::get_if<FunctionGemmaDataProcessorConfig>(&config)) {
        return FunctionGemmaDataProcessor::Create(
            *functionGemma, preface, tokenizer, stopTokenIds, enableConstrainedDecoding);
    }
    if (const auto* gemma4 = std::get_if<Gemma4DataProcessorConfig>(&config)) {
        return eversoul::pc_runtime::Gemma4TextDataProcessor::Create(
            *gemma4, preface, tokenizer, stopTokenIds, enableConstrainedDecoding);
    }
    if (const auto* fastVlm = std::get_if<FastVlmDataProcessorConfig>(&config)) {
        return eversoul::pc_runtime::FastVlmTextDataProcessor::Create(*fastVlm);
    }
    return absl::InvalidArgumentError("Unsupported data processor config type");
}

absl::Status ValidateVisualTokenBudget(const DataProcessorArguments& arguments, int) {
    const std::optional<int>* budget = nullptr;
    if (const auto* gemma4 = std::get_if<Gemma4DataProcessorArguments>(&arguments)) budget = &gemma4->visual_token_budget;
    if (const auto* generic = std::get_if<GenericDataProcessorArguments>(&arguments)) budget = &generic->visual_token_budget;
    if (budget != nullptr && budget->has_value()) {
        return absl::InvalidArgumentError("pc_text_runtime_rejects_visual_token_budget");
    }
    return absl::OkStatus();
}

}
