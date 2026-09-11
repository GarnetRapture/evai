#pragma once

#include <string>
#include <vector>

#include "eversoul/litertlm/llm_metadata.h"

namespace eversoul::inference {

enum class ChatRole {
    System,
    User,
    Model,
};

struct ChatTurn {
    ChatRole role;
    std::string content;
};

struct ChatPrompt {
    std::string systemPrompt;
    std::vector<ChatTurn> history;
    std::string userMessage;
};

[[nodiscard]] std::string renderChatPrompt(const litertlm::LlmMetadata& metadata, const ChatPrompt& prompt);

}
