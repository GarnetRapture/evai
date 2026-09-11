#include "eversoul/inference/chat_prompt.h"

namespace eversoul::inference {
namespace {

using litertlm::LlmModelFamily;
using litertlm::PromptAffixes;
using litertlm::PromptTemplates;

struct RoleFormat {
    std::string prefix;
    std::string suffix;
};

struct ChatFormat {
    RoleFormat system;
    RoleFormat user;
    RoleFormat model;
    bool mergeSystemIntoUser;
};

ChatFormat gemmaFormat() {
    return ChatFormat{
        {"", ""},
        {"<start_of_turn>user\n", "<end_of_turn>\n"},
        {"<start_of_turn>model\n", "<end_of_turn>\n"},
        true,
    };
}

ChatFormat qwenFormat() {
    return ChatFormat{
        {"<|im_start|>system\n", "<|im_end|>\n"},
        {"<|im_start|>user\n", "<|im_end|>\n"},
        {"<|im_start|>assistant\n", "<|im_end|>\n"},
        false,
    };
}

ChatFormat formatForFamily(LlmModelFamily family) {
    switch (family) {
        case LlmModelFamily::Qwen3:
        case LlmModelFamily::Qwen2p5:
            return qwenFormat();
        case LlmModelFamily::Gemma3:
        case LlmModelFamily::Gemma3n:
        case LlmModelFamily::Gemma4:
        case LlmModelFamily::FunctionGemma:
            return gemmaFormat();
        default:
            return qwenFormat();
    }
}

RoleFormat fromAffixes(const PromptAffixes& affixes) {
    return RoleFormat{affixes.prefix, affixes.suffix};
}

ChatFormat formatFromMetadata(const litertlm::LlmMetadata& metadata) {
    ChatFormat format = formatForFamily(metadata.modelFamily);
    if (!metadata.promptTemplates.has_value()) {
        return format;
    }
    const PromptTemplates& templates = *metadata.promptTemplates;
    if (templates.user.has_value()) {
        format.user = fromAffixes(*templates.user);
    }
    if (templates.model.has_value()) {
        format.model = fromAffixes(*templates.model);
    }
    if (templates.system.has_value()) {
        format.system = fromAffixes(*templates.system);
        format.mergeSystemIntoUser = false;
    }
    return format;
}

void appendTurn(std::string& out, const RoleFormat& role, std::string_view content) {
    out.append(role.prefix);
    out.append(content);
    out.append(role.suffix);
}

}

std::string renderChatPrompt(const litertlm::LlmMetadata& metadata, const ChatPrompt& prompt) {
    const ChatFormat format = formatFromMetadata(metadata);
    std::string rendered;
    std::string pendingSystem = prompt.systemPrompt;

    if (!pendingSystem.empty() && !format.mergeSystemIntoUser) {
        appendTurn(rendered, format.system, pendingSystem);
        pendingSystem.clear();
    }

    const auto renderUser = [&](std::string_view content) {
        if (!pendingSystem.empty()) {
            std::string merged = pendingSystem;
            merged.append("\n\n");
            merged.append(content);
            appendTurn(rendered, format.user, merged);
            pendingSystem.clear();
        }
        else {
            appendTurn(rendered, format.user, content);
        }
    };

    for (const ChatTurn& turn : prompt.history) {
        switch (turn.role) {
            case ChatRole::System:
                if (format.mergeSystemIntoUser) {
                    pendingSystem = turn.content;
                }
                else {
                    appendTurn(rendered, format.system, turn.content);
                }
                break;
            case ChatRole::User:
                renderUser(turn.content);
                break;
            case ChatRole::Model:
                appendTurn(rendered, format.model, turn.content);
                break;
        }
    }

    renderUser(prompt.userMessage);
    rendered.append(format.model.prefix);
    return rendered;
}

}
