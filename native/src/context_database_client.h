#pragma once

#include <filesystem>
#include <string>
#include <string_view>
#include <vector>

#include "context_database/context_database_api.h"

namespace eversoul::native {

class ContextDatabaseClient {
public:
    explicit ContextDatabaseClient(const std::filesystem::path& path);
    ~ContextDatabaseClient();

    ContextDatabaseClient(const ContextDatabaseClient&) = delete;
    ContextDatabaseClient& operator=(const ContextDatabaseClient&) = delete;

    void appendMessage(
        std::string_view id,
        std::string_view roomId,
        std::string_view personaId,
        std::string_view role,
        std::string_view content,
        std::string_view createdAt);
    void appendMemory(
        std::string_view id,
        std::string_view personaId,
        std::string_view roomId,
        std::string_view type,
        std::string_view text,
        std::string_view createdAt,
        const std::vector<std::string>& sourceMessageIds);
    [[nodiscard]] std::string queryContext(
        std::string_view personaId,
        std::string_view roomId,
        int recentLimit,
        int memoryLimit) const;
    [[nodiscard]] std::string queryStatistics() const;
    void deleteMessage(std::string_view messageId);
    void deleteRoom(std::string_view roomId);
    void clearAll();

    [[nodiscard]] static std::string engineVersion();

private:
    EverSoulContextDatabase* database_ = nullptr;
};

}
