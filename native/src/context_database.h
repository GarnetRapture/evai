#pragma once

#include <filesystem>
#include <string>
#include <string_view>
#include <vector>

struct sqlite3;

namespace eversoul::native {

class ContextDatabase {
public:
    explicit ContextDatabase(const std::filesystem::path& path);
    ~ContextDatabase();

    ContextDatabase(const ContextDatabase&) = delete;
    ContextDatabase& operator=(const ContextDatabase&) = delete;

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

private:
    sqlite3* database_ = nullptr;
};

[[nodiscard]] std::string jsonEscape(std::string_view text);

}
