#include "context_database_client.h"

#include <cstdint>
#include <filesystem>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

#include "context_database/context_database_api.h"

namespace eversoul::native {
namespace {

EverSoulTextView textView(std::string_view text) noexcept {
    return EverSoulTextView{text.data(), text.size()};
}

class ReleasedText {
public:
    ReleasedText() = default;
    ReleasedText(const ReleasedText&) = delete;
    ReleasedText& operator=(const ReleasedText&) = delete;
    ~ReleasedText() { eversoul_context_database_release_text(&buffer_); }

    [[nodiscard]] EverSoulTextBuffer* output() noexcept { return &buffer_; }

    [[nodiscard]] std::string text() const {
        return buffer_.data == nullptr ? std::string{} : std::string(buffer_.data, buffer_.size);
    }

private:
    EverSoulTextBuffer buffer_{nullptr, 0};
};

std::string requireSuccess(EverSoulContextDatabaseStatus status, const ReleasedText& text) {
    if (status != EVERSOUL_CONTEXT_DATABASE_OK) {
        const std::string message = text.text();
        throw std::runtime_error(message.empty() ? "context_database_failed" : message);
    }
    return text.text();
}

}

ContextDatabaseClient::ContextDatabaseClient(const std::filesystem::path& path) {
    const std::u8string utf8Path = path.u8string();
    ReleasedText text;
    requireSuccess(eversoul_context_database_open(
        EverSoulTextView{reinterpret_cast<const char*>(utf8Path.data()), utf8Path.size()},
        &database_, text.output()), text);
}

ContextDatabaseClient::~ContextDatabaseClient() {
    eversoul_context_database_close(database_);
}

void ContextDatabaseClient::appendMessage(
    std::string_view id,
    std::string_view roomId,
    std::string_view personaId,
    std::string_view role,
    std::string_view content,
    std::string_view createdAt) {
    ReleasedText text;
    requireSuccess(eversoul_context_database_append_message(
        database_, textView(id), textView(roomId), textView(personaId),
        textView(role), textView(content), textView(createdAt), text.output()), text);
}

void ContextDatabaseClient::appendMemory(
    std::string_view id,
    std::string_view personaId,
    std::string_view roomId,
    std::string_view type,
    std::string_view text,
    std::string_view createdAt,
    const std::vector<std::string>& sourceMessageIds) {
    std::vector<EverSoulTextView> sources;
    sources.reserve(sourceMessageIds.size());
    for (const std::string& sourceMessageId : sourceMessageIds) sources.push_back(textView(sourceMessageId));
    ReleasedText result;
    requireSuccess(eversoul_context_database_append_memory(
        database_, textView(id), textView(personaId), textView(roomId),
        textView(type), textView(text), textView(createdAt),
        sources.data(), sources.size(), result.output()), result);
}

std::string ContextDatabaseClient::queryContext(
    std::string_view personaId,
    std::string_view roomId,
    int recentLimit,
    int memoryLimit) const {
    ReleasedText text;
    return requireSuccess(eversoul_context_database_query_context(
        database_, textView(personaId), textView(roomId),
        static_cast<std::int32_t>(recentLimit), static_cast<std::int32_t>(memoryLimit), text.output()), text);
}

std::string ContextDatabaseClient::queryStatistics() const {
    ReleasedText text;
    return requireSuccess(eversoul_context_database_query_statistics(database_, text.output()), text);
}

void ContextDatabaseClient::deleteMessage(std::string_view messageId) {
    ReleasedText text;
    requireSuccess(eversoul_context_database_delete_message(database_, textView(messageId), text.output()), text);
}

void ContextDatabaseClient::deleteRoom(std::string_view roomId) {
    ReleasedText text;
    requireSuccess(eversoul_context_database_delete_room(database_, textView(roomId), text.output()), text);
}

void ContextDatabaseClient::clearAll() {
    ReleasedText text;
    requireSuccess(eversoul_context_database_clear_all(database_, text.output()), text);
}

std::string ContextDatabaseClient::engineVersion() {
    const EverSoulTextView version = eversoul_context_database_engine_version();
    return std::string(version.data, version.size);
}

}
