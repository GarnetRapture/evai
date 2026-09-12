#include "context_database.h"

#include <array>
#include <cstdint>
#include <filesystem>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>
#include <string_view>

#include <sqlite3.h>

#include "eversoul/format/json_value.h"

#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#include <process.h>
#else
#include <unistd.h>
#endif

namespace {

using eversoul::format::JsonValue;
using eversoul::native::ContextDatabase;
using eversoul::native::jsonEscape;

constexpr std::uint32_t kMaximumFrameBytes = 8U * 1024U * 1024U;
constexpr std::size_t kMaximumNativeMessageResponseBytes = 1024U * 1024U;

std::uint64_t currentProcessId() {
#ifdef _WIN32
    return static_cast<std::uint64_t>(_getpid());
#else
    return static_cast<std::uint64_t>(getpid());
#endif
}

std::string requiredString(const JsonValue& request, std::string_view key) {
    const JsonValue* value = request.find(key);
    if (value == nullptr) {
        throw std::runtime_error("missing_" + std::string(key));
    }
    auto text = value->asString();
    if (!text) {
        throw std::runtime_error("invalid_" + std::string(key));
    }
    return std::string(*text);
}

std::string optionalString(const JsonValue& request, std::string_view key) {
    const JsonValue* value = request.find(key);
    if (value == nullptr) {
        return {};
    }
    auto text = value->asString();
    return text ? std::string(*text) : std::string{};
}

std::vector<std::string> optionalStringArray(const JsonValue& request, std::string_view key) {
    const JsonValue* value = request.find(key);
    if (value == nullptr) return {};
    auto array = value->asArray();
    if (!array) throw std::runtime_error("invalid_" + std::string(key));
    std::vector<std::string> result;
    for (const JsonValue& entry : **array) {
        auto text = entry.asString();
        if (!text) throw std::runtime_error("invalid_" + std::string(key));
        result.emplace_back(*text);
    }
    return result;
}

const eversoul::format::JsonArray& requiredArray(const JsonValue& request, std::string_view key) {
    const JsonValue* value = request.find(key);
    if (value == nullptr) throw std::runtime_error("missing_" + std::string(key));
    auto array = value->asArray();
    if (!array) throw std::runtime_error("invalid_" + std::string(key));
    return **array;
}

int optionalInt(const JsonValue& request, std::string_view key, int fallback) {
    const JsonValue* value = request.find(key);
    if (value == nullptr) {
        return fallback;
    }
    auto number = value->asNumber();
    if (!number || *number < 0 || *number > static_cast<double>(std::numeric_limits<int>::max())) {
        throw std::runtime_error("invalid_" + std::string(key));
    }
    return static_cast<int>(*number);
}

std::string handleRequest(
    ContextDatabase& database,
    std::string_view payload,
    const std::filesystem::path& executablePath,
    const std::filesystem::path& databasePath) {
    auto parsed = eversoul::format::parseJson(payload);
    if (!parsed || !parsed->isObject()) {
        throw std::runtime_error("invalid_json_request");
    }
    const std::string operation = requiredString(*parsed, "operation");
    if (operation == "health") {
        const auto fileBytes = [](const std::filesystem::path& path) -> std::uintmax_t {
            std::error_code error;
            const auto bytes = std::filesystem::file_size(path, error);
            return error ? 0U : bytes;
        };
        const auto databaseFileBytes = fileBytes(databasePath);
        const auto walBytes = fileBytes(std::filesystem::path(databasePath.string() + "-wal"));
        const auto sharedMemoryBytes = fileBytes(std::filesystem::path(databasePath.string() + "-shm"));
        const auto databaseBytes = databaseFileBytes + walBytes + sharedMemoryBytes;
        return "{\"ok\":true,\"protocol\":1,\"storage\":\"sqlite\",\"process_id\":"
            + std::to_string(currentProcessId()) + ",\"sqlite\":\""
            + jsonEscape(sqlite3_libversion()) + "\",\"executable_path\":\""
            + jsonEscape(executablePath.string()) + "\",\"database_path\":\""
            + jsonEscape(databasePath.string()) + "\",\"database_bytes\":"
            + std::to_string(databaseBytes) + ",\"database_file_bytes\":"
            + std::to_string(databaseFileBytes) + ",\"wal_bytes\":"
            + std::to_string(walBytes) + ",\"shared_memory_bytes\":"
            + std::to_string(sharedMemoryBytes) + "}";
    }
    if (operation == "statistics") {
        return "{\"ok\":true,\"statistics\":" + database.queryStatistics() + "}";
    }
    if (operation == "append_message") {
        database.appendMessage(
            requiredString(*parsed, "id"),
            requiredString(*parsed, "room_id"),
            requiredString(*parsed, "persona_id"),
            requiredString(*parsed, "role"),
            requiredString(*parsed, "content"),
            requiredString(*parsed, "created_at"));
        return "{\"ok\":true}";
    }
    if (operation == "append_memory") {
        database.appendMemory(
            requiredString(*parsed, "id"),
            requiredString(*parsed, "persona_id"),
            optionalString(*parsed, "room_id"),
            requiredString(*parsed, "memory_type"),
            requiredString(*parsed, "memory_text"),
            requiredString(*parsed, "created_at"),
            optionalStringArray(*parsed, "source_message_ids"));
        return "{\"ok\":true}";
    }
    if (operation == "sync_messages") {
        for (const JsonValue& message : requiredArray(*parsed, "messages")) {
            database.appendMessage(
                requiredString(message, "id"),
                requiredString(message, "room_id"),
                requiredString(message, "persona_id"),
                requiredString(message, "role"),
                requiredString(message, "content"),
                requiredString(message, "created_at"));
        }
        return "{\"ok\":true}";
    }
    if (operation == "sync_memories") {
        for (const JsonValue& memory : requiredArray(*parsed, "memories")) {
            database.appendMemory(
                requiredString(memory, "id"),
                requiredString(memory, "persona_id"),
                optionalString(memory, "room_id"),
                requiredString(memory, "memory_type"),
                requiredString(memory, "memory_text"),
                requiredString(memory, "created_at"),
                optionalStringArray(memory, "source_message_ids"));
        }
        return "{\"ok\":true}";
    }
    if (operation == "query_context") {
        return "{\"ok\":true,\"context\":" + database.queryContext(
            requiredString(*parsed, "persona_id"),
            requiredString(*parsed, "room_id"),
            optionalInt(*parsed, "recent_limit", 18),
            optionalInt(*parsed, "memory_limit", 30)) + '}';
    }
    if (operation == "delete_message") {
        database.deleteMessage(requiredString(*parsed, "message_id"));
        return "{\"ok\":true}";
    }
    if (operation == "delete_room") {
        database.deleteRoom(requiredString(*parsed, "room_id"));
        return "{\"ok\":true}";
    }
    if (operation == "clear_all") {
        database.clearAll();
        return "{\"ok\":true}";
    }
    throw std::runtime_error("unknown_operation");
}

std::string errorResponse(const std::exception& error) {
    return "{\"ok\":false,\"error\":\"" + jsonEscape(error.what()) + "\"}";
}

bool readFrame(std::istream& input, bool jsonLines, std::string& payload) {
    if (jsonLines) {
        return static_cast<bool>(std::getline(input, payload));
    }
    std::array<unsigned char, 4> sizeBytes{};
    if (!input.read(reinterpret_cast<char*>(sizeBytes.data()), sizeBytes.size())) {
        return false;
    }
    const std::uint32_t size = static_cast<std::uint32_t>(sizeBytes[0])
        | (static_cast<std::uint32_t>(sizeBytes[1]) << 8U)
        | (static_cast<std::uint32_t>(sizeBytes[2]) << 16U)
        | (static_cast<std::uint32_t>(sizeBytes[3]) << 24U);
    if (size > kMaximumFrameBytes) {
        throw std::runtime_error("frame_too_large");
    }
    payload.resize(size);
    if (!input.read(payload.data(), static_cast<std::streamsize>(size))) {
        throw std::runtime_error("truncated_frame");
    }
    return true;
}

void writeFrame(std::ostream& output, bool jsonLines, std::string_view payload) {
    if (jsonLines) {
        output << payload << '\n' << std::flush;
        return;
    }
    constexpr std::string_view responseTooLarge = R"({"ok":false,"error":"response_too_large"})";
    if (payload.size() > kMaximumNativeMessageResponseBytes) {
        payload = responseTooLarge;
    }
    const auto size = static_cast<std::uint32_t>(payload.size());
    const std::array<unsigned char, 4> sizeBytes{
        static_cast<unsigned char>(size & 0xffU),
        static_cast<unsigned char>((size >> 8U) & 0xffU),
        static_cast<unsigned char>((size >> 16U) & 0xffU),
        static_cast<unsigned char>((size >> 24U) & 0xffU),
    };
    output.write(reinterpret_cast<const char*>(sizeBytes.data()), sizeBytes.size());
    output.write(payload.data(), static_cast<std::streamsize>(payload.size()));
    output.flush();
}

int selfTest() {
    const auto path = std::filesystem::temp_directory_path() / "eversoul-native-context-self-test.sqlite3";
    std::error_code ignored;
    std::filesystem::remove(path, ignored);
    {
        ContextDatabase database(path);
        database.appendMessage("u1", "r1", "xiaolian", "user", "만두 먹자", "2026-09-12T00:00:00.000Z");
        database.appendMessage("a1", "r1", "xiaolian", "assistant", "좋아!", "2026-09-12T00:00:01.000Z");
        database.appendMemory("m1", "xiaolian", "r1", "episodic", "함께 만두를 먹기로 했다", "2026-09-12T00:00:02.000Z", {"u1"});
        const std::string context = database.queryContext("xiaolian", "r1", 18, 30);
        if (!context.contains("만두 먹자") || !context.contains("함께 만두를 먹기로 했다")) {
            throw std::runtime_error("self_test_query_failed");
        }
        database.deleteMessage("u1");
        if (database.queryContext("xiaolian", "r1", 18, 30).contains("함께 만두를 먹기로 했다")) {
            throw std::runtime_error("self_test_provenance_delete_failed");
        }
        database.deleteRoom("r1");
        if (database.queryContext("xiaolian", "r1", 18, 30).contains("좋아!")) {
            throw std::runtime_error("self_test_room_delete_failed");
        }
    }
    std::filesystem::remove(path, ignored);
    std::filesystem::remove(path.string() + "-wal", ignored);
    std::filesystem::remove(path.string() + "-shm", ignored);
    std::cout << "native_context_self_test: passed\n";
    return 0;
}

}

int main(int argc, char** argv) {
    try {
        bool jsonLines = false;
        const std::filesystem::path executablePath = std::filesystem::absolute(argv[0]);
        std::filesystem::path databasePath = executablePath.parent_path() / "eversoul-context.sqlite3";
        for (int index = 1; index < argc; ++index) {
            const std::string_view argument(argv[index]);
            if (argument == "--self-test") {
                return selfTest();
            }
            if (argument == "--jsonl") {
                jsonLines = true;
            }
            else if (argument == "--db" && index + 1 < argc) {
                databasePath = argv[++index];
            }
        }
#ifdef _WIN32
        if (!jsonLines) {
            _setmode(_fileno(stdin), _O_BINARY);
            _setmode(_fileno(stdout), _O_BINARY);
        }
#endif
        ContextDatabase database(databasePath);
        std::string payload;
        while (readFrame(std::cin, jsonLines, payload)) {
            try {
                writeFrame(std::cout, jsonLines, handleRequest(database, payload, executablePath, databasePath));
            }
            catch (const std::exception& error) {
                writeFrame(std::cout, jsonLines, errorResponse(error));
            }
        }
        return 0;
    }
    catch (const std::exception& error) {
        std::cerr << "eversoul-native-host: " << error.what() << '\n';
        return 1;
    }
}
