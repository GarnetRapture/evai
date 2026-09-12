#include "context_database.h"
#include "model_runtime.h"
#include "native_settings.h"

#include <array>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>

#include <sqlite3.h>

#include "eversoul/format/json_value.h"

#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#include <process.h>
#include <windows.h>
#else
#include <fcntl.h>
#include <sys/file.h>
#include <unistd.h>
#endif

namespace {

using eversoul::format::JsonValue;
using eversoul::native::ContextDatabase;
using eversoul::native::GenerationStatus;
using eversoul::native::ModelConfiguration;
using eversoul::native::ModelRuntimeStatus;
using eversoul::native::NativeChatMessage;
using eversoul::native::NativeGenerationPrompt;
using eversoul::native::NativeModelRuntime;
using eversoul::native::jsonEscape;

constexpr std::uint32_t kMaximumFrameBytes = 8U * 1024U * 1024U;
constexpr std::size_t kMaximumNativeMessageResponseBytes = 1024U * 1024U;

std::string pathUtf8(const std::filesystem::path& path) {
    const std::u8string value = path.generic_u8string();
    return std::string(reinterpret_cast<const char*>(value.data()), value.size());
}

std::filesystem::path pathFromUtf8(const std::string& value) {
    return std::filesystem::path(std::u8string(
        reinterpret_cast<const char8_t*>(value.data()),
        reinterpret_cast<const char8_t*>(value.data() + value.size())));
}

std::string nullablePathJson(const std::filesystem::path& path) {
    return path.empty() ? "null" : "\"" + jsonEscape(pathUtf8(path)) + "\"";
}

std::string modelStatusJson(const ModelRuntimeStatus& status) {
    return "{\"configured\":" + std::string(status.configured ? "true" : "false")
        + ",\"model_found\":" + (status.modelFound ? "true" : "false")
        + ",\"loaded\":" + (status.loaded ? "true" : "false")
        + ",\"configured_model_path\":" + nullablePathJson(status.configuredModelPath)
        + ",\"resolved_model_path\":" + nullablePathJson(status.resolvedModelPath)
        + ",\"runtime_path\":" + nullablePathJson(status.runtimePath)
        + ",\"backend\":\"" + jsonEscape(status.backend) + "\""
        + ",\"architecture\":\"" + jsonEscape(status.architecture) + "\""
        + ",\"context_window\":" + std::to_string(status.contextWindow)
        + ",\"error\":" + (status.error.empty() ? "null" : "\"" + jsonEscape(status.error) + "\"") + '}';
}

std::string generationStatusJson(const GenerationStatus& status) {
    return "{\"request_id\":" + (status.requestId.empty() ? "null" : "\"" + jsonEscape(status.requestId) + "\"")
        + ",\"state\":\"" + jsonEscape(status.state) + "\""
        + ",\"text\":\"" + jsonEscape(status.text) + "\""
        + ",\"prompt_tokens\":" + std::to_string(status.promptTokens)
        + ",\"generated_tokens\":" + std::to_string(status.generatedTokens)
        + ",\"error\":" + (status.error.empty() ? "null" : "\"" + jsonEscape(status.error) + "\"") + '}';
}

enum class DisplayLanguage { Korean, English, Chinese };

std::string_view languageCode(DisplayLanguage language) {
    switch (language) {
    case DisplayLanguage::Korean: return "ko";
    case DisplayLanguage::Chinese: return "zh_cn";
    default: return "en";
    }
}

DisplayLanguage languageFromCode(std::string_view code) {
    if (code == "ko") return DisplayLanguage::Korean;
    if (code == "zh_cn") return DisplayLanguage::Chinese;
    return DisplayLanguage::English;
}

class ProcessInstanceGuard {
public:
    explicit ProcessInstanceGuard(const std::filesystem::path& executablePath) {
#ifdef _WIN32
        const auto key = std::hash<std::string>{}(executablePath.lexically_normal().string());
        const std::wstring name = L"Local\\EverSoulNativeHost-" + std::to_wstring(key);
        handle_ = CreateMutexW(nullptr, FALSE, name.c_str());
        if (handle_ == nullptr) throw std::runtime_error("native_host_singleton_failed");
        if (GetLastError() == ERROR_ALREADY_EXISTS) {
            CloseHandle(handle_);
            handle_ = nullptr;
            throw std::runtime_error("native_host_already_running");
        }
#else
        const auto lockPath = executablePath.parent_path() / ".eversoul-native-host.lock";
        descriptor_ = open(lockPath.c_str(), O_CREAT | O_RDWR, 0600);
        if (descriptor_ < 0 || flock(descriptor_, LOCK_EX | LOCK_NB) != 0) {
            if (descriptor_ >= 0) close(descriptor_);
            descriptor_ = -1;
            throw std::runtime_error("native_host_already_running");
        }
#endif
    }

    ProcessInstanceGuard(const ProcessInstanceGuard&) = delete;
    ProcessInstanceGuard& operator=(const ProcessInstanceGuard&) = delete;

    ~ProcessInstanceGuard() {
#ifdef _WIN32
        if (handle_ != nullptr) CloseHandle(handle_);
#else
        if (descriptor_ >= 0) {
            flock(descriptor_, LOCK_UN);
            close(descriptor_);
        }
#endif
    }

private:
#ifdef _WIN32
    HANDLE handle_ = nullptr;
#else
    int descriptor_ = -1;
#endif
};

class HostStatusConsole {
public:
    explicit HostStatusConsole(bool enabled) : enabled_(enabled) {
        if (!enabled_) return;
#ifdef _WIN32
        if (GetConsoleWindow() == nullptr) AllocConsole();
        SetConsoleOutputCP(CP_UTF8);
        SetConsoleTitleW(L"EverSoul Native Host");
        output_ = CreateFileW(L"CONOUT$", GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE,
            nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
#endif
    }

    HostStatusConsole(const HostStatusConsole&) = delete;
    HostStatusConsole& operator=(const HostStatusConsole&) = delete;

    ~HostStatusConsole() {
#ifdef _WIN32
        if (output_ != nullptr && output_ != INVALID_HANDLE_VALUE) CloseHandle(output_);
#endif
    }

    DisplayLanguage resolveLanguage(const std::filesystem::path& settingsPath, bool promptIfMissing) {
        std::ifstream settings(settingsPath);
        std::string line;
        while (std::getline(settings, line)) {
            constexpr std::string_view prefix = "language=";
            if (!line.starts_with(prefix)) continue;
            const std::string code = line.substr(prefix.size());
            if (code == "ko" || code == "en" || code == "zh_cn") return languageFromCode(code);
        }
        if (!promptIfMissing) return DisplayLanguage::English;
        writeUtf8(
            "EverSoul Native Host - Display language / 표시 언어 / 显示语言\n\n"
            "  1. 한국어\n"
            "  2. English\n"
            "  3. 简体中文\n\n"
            "Select 1, 2, or 3 / 1, 2, 3 중 선택 / 请选择 1、2 或 3: ");
        const int choice = readChoice();
        const DisplayLanguage language = languageForChoice(choice);
        saveLanguage(settingsPath, language);
        return language;
    }

    static DisplayLanguage languageForChoice(int choice) {
        return choice == 1 ? DisplayLanguage::Korean
            : choice == 3 ? DisplayLanguage::Chinese : DisplayLanguage::English;
    }

    static void saveLanguage(const std::filesystem::path& settingsPath, DisplayLanguage language) {
        eversoul::native::updateNativeSettings(settingsPath, {{"language", std::string(languageCode(language))}});
    }

    void show(
        DisplayLanguage language,
        bool connected,
        std::uint64_t processId,
        const std::filesystem::path& executablePath,
        const std::filesystem::path& databasePath,
        const std::filesystem::path& settingsPath) {
        if (!enabled_) return;
        language_ = language;
        processId_ = processId;
        executablePath_ = executablePath;
        databasePath_ = databasePath;
        settingsPath_ = settingsPath;
        connected_ = connected;
        render();
    }

    void markConnected() {
        if (!enabled_ || connected_) return;
        connected_ = true;
        render();
    }

    void updateInference(ModelRuntimeStatus status) {
        if (!enabled_) return;
        inference_ = std::move(status);
        render();
    }

private:
    int readChoice() {
#ifdef _WIN32
        HANDLE input = CreateFileW(L"CONIN$", GENERIC_READ | GENERIC_WRITE,
            FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (input == INVALID_HANDLE_VALUE) return 2;
        wchar_t buffer[16]{};
        DWORD read = 0;
        const BOOL ok = ReadConsoleW(input, buffer, 15, &read, nullptr);
        CloseHandle(input);
        if (!ok || read == 0) return 2;
        return buffer[0] == L'1' ? 1 : buffer[0] == L'3' ? 3 : 2;
#else
        std::ifstream terminal("/dev/tty");
        int choice = 2;
        if (terminal) terminal >> choice;
        return choice;
#endif
    }

    void writeUtf8(std::string_view text) {
        if (!enabled_) return;
#ifdef _WIN32
        if (output_ != nullptr && output_ != INVALID_HANDLE_VALUE) {
            const int length = MultiByteToWideChar(CP_UTF8, 0, text.data(), static_cast<int>(text.size()), nullptr, 0);
            std::wstring wide(static_cast<std::size_t>(length), L'\0');
            MultiByteToWideChar(CP_UTF8, 0, text.data(), static_cast<int>(text.size()), wide.data(), length);
            DWORD written = 0;
            WriteConsoleW(output_, wide.data(), static_cast<DWORD>(wide.size()), &written, nullptr);
        }
#else
        std::clog << text << std::flush;
#endif
    }

    void clear() {
#ifdef _WIN32
        if (output_ == nullptr || output_ == INVALID_HANDLE_VALUE) return;
        CONSOLE_SCREEN_BUFFER_INFO info{};
        if (!GetConsoleScreenBufferInfo(output_, &info)) return;
        const DWORD cells = static_cast<DWORD>(info.dwSize.X) * static_cast<DWORD>(info.dwSize.Y);
        DWORD written = 0;
        FillConsoleOutputCharacterW(output_, L' ', cells, {0, 0}, &written);
        FillConsoleOutputAttribute(output_, info.wAttributes, cells, {0, 0}, &written);
        SetConsoleCursorPosition(output_, {0, 0});
#else
        std::clog << "\033[2J\033[H";
#endif
    }

    void render() {
        clear();
        std::string title;
        std::string connection;
        std::string sqlite;
        std::string pid;
        std::string executable;
        std::string database;
        std::string settings;
        std::string singleton;
        std::string inference;
        std::string model;
        std::string runtime;
        std::string closeHint;
        if (language_ == DisplayLanguage::Korean) {
            title = "에버소울 네이티브 호스트";
            connection = connected_ ? "연결 상태 : 연결됨" : "연결 상태 : 브라우저 연결 대기 중";
            sqlite = "SQLite 상태 : 정상";
            pid = "프로세스 PID";
            executable = "실행 파일";
            database = "데이터베이스";
            settings = "언어 설정";
            singleton = "중복 실행 방지 : 활성";
            inference = inference_.loaded ? "온디바이스 추론 : 모델 로드됨"
                : inference_.configured ? "온디바이스 추론 : 모델 로드 대기" : "온디바이스 추론 : 경로 미설정";
            model = "모델";
            runtime = "LiteRT 런타임";
            closeHint = "이 창을 닫으면 네이티브 호스트가 즉시 종료됩니다.";
        }
        else if (language_ == DisplayLanguage::Chinese) {
            title = "EverSoul 原生主机";
            connection = connected_ ? "连接状态：已连接" : "连接状态：等待浏览器连接";
            sqlite = "SQLite 状态：正常";
            pid = "进程 PID";
            executable = "可执行文件";
            database = "数据库";
            settings = "语言设置";
            singleton = "防止重复运行：已启用";
            inference = inference_.loaded ? "设备端推理：模型已加载"
                : inference_.configured ? "设备端推理：等待加载模型" : "设备端推理：未设置路径";
            model = "模型";
            runtime = "LiteRT 运行时";
            closeHint = "关闭此窗口将立即停止原生主机。";
        }
        else {
            title = "EverSoul Native Host";
            connection = connected_ ? "Connection : Connected" : "Connection : Waiting for browser";
            sqlite = "SQLite : Healthy";
            pid = "Process PID";
            executable = "Executable";
            database = "Database";
            settings = "Language settings";
            singleton = "Duplicate process prevention : Active";
            inference = inference_.loaded ? "On-device inference : Model loaded"
                : inference_.configured ? "On-device inference : Waiting for model load" : "On-device inference : Path not configured";
            model = "Model";
            runtime = "LiteRT runtime";
            closeHint = "Close this window to stop the native host immediately.";
        }
        writeUtf8(
            title + "\n========================================\n"
            + connection + '\n' + sqlite + '\n' + inference + '\n' + singleton + "\n\n"
            + pid + " : " + std::to_string(processId_) + '\n'
            + executable + " : " + pathUtf8(executablePath_) + '\n'
            + database + " : " + pathUtf8(databasePath_) + '\n'
            + settings + " : " + pathUtf8(settingsPath_) + '\n'
            + model + " : " + (inference_.resolvedModelPath.empty() ? "-" : pathUtf8(inference_.resolvedModelPath)) + '\n'
            + runtime + " : " + (inference_.runtimePath.empty() ? "-" : pathUtf8(inference_.runtimePath)) + "\n\n"
            + closeHint + '\n');
    }

    bool enabled_ = false;
    bool connected_ = false;
    DisplayLanguage language_ = DisplayLanguage::English;
    std::uint64_t processId_ = 0;
    std::filesystem::path executablePath_;
    std::filesystem::path databasePath_;
    std::filesystem::path settingsPath_;
    ModelRuntimeStatus inference_;
#ifdef _WIN32
    HANDLE output_ = INVALID_HANDLE_VALUE;
#endif
};

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

NativeGenerationPrompt generationPrompt(const JsonValue& request) {
    NativeGenerationPrompt prompt;
    prompt.systemPrompt = optionalString(request, "system_prompt");
    prompt.responsePrefix = optionalString(request, "response_prefix");
    for (const JsonValue& entry : requiredArray(request, "messages")) {
        const std::string role = requiredString(entry, "role");
        if (role != "user" && role != "assistant") throw std::runtime_error("invalid_message_role");
        prompt.messages.push_back(NativeChatMessage{role, requiredString(entry, "content")});
    }
    return prompt;
}

ModelConfiguration modelConfiguration(const JsonValue& request, const NativeModelRuntime& runtime) {
    ModelConfiguration configuration = runtime.configuration();
    if (const JsonValue* value = request.find("model_path"); value != nullptr) {
        auto text = value->asString();
        if (!text || text->empty()) throw std::runtime_error("invalid_model_path");
        configuration.modelPath = pathFromUtf8(std::string(*text));
    }
    if (request.find("model_file") != nullptr) configuration.modelFile = optionalString(request, "model_file");
    if (request.find("runtime_path") != nullptr) configuration.runtimePath = pathFromUtf8(optionalString(request, "runtime_path"));
    if (request.find("backend") != nullptr) configuration.backend = optionalString(request, "backend");
    configuration.contextWindow = optionalInt(request, "context_window", configuration.contextWindow);
    return configuration;
}

std::string handleRequest(
    ContextDatabase& database,
    NativeModelRuntime& modelRuntime,
    std::string_view payload,
    const std::filesystem::path& executablePath,
    const std::filesystem::path& databasePath,
    const std::filesystem::path& settingsPath,
    DisplayLanguage displayLanguage) {
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
        return "{\"ok\":true,\"protocol\":2,\"storage\":\"sqlite\",\"process_id\":"
            + std::to_string(currentProcessId()) + ",\"sqlite\":\""
            + jsonEscape(sqlite3_libversion()) + "\",\"executable_path\":\""
            + jsonEscape(pathUtf8(executablePath)) + "\",\"database_path\":\""
            + jsonEscape(pathUtf8(databasePath)) + "\",\"database_bytes\":"
            + std::to_string(databaseBytes) + ",\"database_file_bytes\":"
            + std::to_string(databaseFileBytes) + ",\"wal_bytes\":"
            + std::to_string(walBytes) + ",\"shared_memory_bytes\":"
            + std::to_string(sharedMemoryBytes)
            + ",\"single_instance\":true,\"display_language\":\""
            + std::string(languageCode(displayLanguage)) + "\",\"settings_path\":\""
            + jsonEscape(pathUtf8(settingsPath)) + "\",\"inference\":"
            + modelStatusJson(modelRuntime.status()) + '}';
    }
    if (operation == "model_status" || operation == "inference_status") {
        return "{\"ok\":true,\"model\":" + modelStatusJson(modelRuntime.status())
            + ",\"generation\":" + generationStatusJson(modelRuntime.generationStatus()) + '}';
    }
    if (operation == "configure_model" || operation == "configure_inference") {
        modelRuntime.configure(modelConfiguration(*parsed, modelRuntime), true);
        return "{\"ok\":true,\"model\":" + modelStatusJson(modelRuntime.status()) + '}';
    }
    if (operation == "load_model") {
        if (parsed->find("model_path") != nullptr || parsed->find("model_file") != nullptr
            || parsed->find("runtime_path") != nullptr || parsed->find("backend") != nullptr
            || parsed->find("context_window") != nullptr) {
            modelRuntime.configure(modelConfiguration(*parsed, modelRuntime), true);
        }
        modelRuntime.load();
        return "{\"ok\":true,\"model\":" + modelStatusJson(modelRuntime.status()) + '}';
    }
    if (operation == "unload_model") {
        modelRuntime.unload();
        return "{\"ok\":true,\"model\":" + modelStatusJson(modelRuntime.status()) + '}';
    }
    if (operation == "start_generation") {
        const std::string requestId = requiredString(*parsed, "request_id");
        modelRuntime.startGeneration(
            requestId, generationPrompt(*parsed), optionalInt(*parsed, "max_output_tokens", 512));
        return "{\"ok\":true,\"generation\":"
            + generationStatusJson(modelRuntime.generationStatus(requestId)) + '}';
    }
    if (operation == "generation_status" || operation == "poll_generation") {
        return "{\"ok\":true,\"generation\":"
            + generationStatusJson(modelRuntime.generationStatus(optionalString(*parsed, "request_id"))) + '}';
    }
    if (operation == "cancel_generation") {
        const std::string requestId = requiredString(*parsed, "request_id");
        modelRuntime.cancelGeneration(requestId);
        return "{\"ok\":true,\"generation\":"
            + generationStatusJson(modelRuntime.generationStatus(requestId)) + '}';
    }
    if (operation == "generate") {
        const std::string requestId = requiredString(*parsed, "request_id");
        modelRuntime.startGeneration(
            requestId, generationPrompt(*parsed), optionalInt(*parsed, "max_output_tokens", 512));
        return "{\"ok\":true,\"generation\":"
            + generationStatusJson(modelRuntime.waitForGeneration(requestId)) + '}';
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
        bool consoleEnabled = true;
        int configureLanguageChoice = 0;
        const std::filesystem::path executablePath = std::filesystem::absolute(argv[0]);
        std::filesystem::path databasePath = executablePath.parent_path() / "eversoul-context.sqlite3";
        std::filesystem::path settingsPath = executablePath.parent_path() / "eversoul-native-host.ini";
        for (int index = 1; index < argc; ++index) {
            const std::string_view argument(argv[index]);
            if (argument == "--self-test") {
                return selfTest();
            }
            if (argument == "--headless") {
                consoleEnabled = false;
            }
            if (argument == "--visible-console") {
                consoleEnabled = true;
            }
            if (argument == "--jsonl") {
                jsonLines = true;
            }
            else if (argument == "--db" && index + 1 < argc) {
                databasePath = argv[++index];
            }
            else if (argument == "--settings" && index + 1 < argc) {
                settingsPath = argv[++index];
            }
            else if (argument == "--configure-language" && index + 1 < argc) {
                configureLanguageChoice = std::stoi(argv[++index]);
            }
        }
        if (configureLanguageChoice != 0) {
            if (configureLanguageChoice < 1 || configureLanguageChoice > 3) {
                throw std::runtime_error("invalid_display_language_choice");
            }
            HostStatusConsole::saveLanguage(
                settingsPath, HostStatusConsole::languageForChoice(configureLanguageChoice));
            return 0;
        }
#ifdef _WIN32
        if (!jsonLines) {
            _setmode(_fileno(stdin), _O_BINARY);
            _setmode(_fileno(stdout), _O_BINARY);
        }
#endif
        ProcessInstanceGuard instanceGuard(executablePath);
        HostStatusConsole statusConsole(consoleEnabled);
        const DisplayLanguage displayLanguage = statusConsole.resolveLanguage(settingsPath, consoleEnabled);
        ContextDatabase database(databasePath);
        NativeModelRuntime modelRuntime(executablePath, settingsPath);
        statusConsole.show(displayLanguage, false, currentProcessId(), executablePath, databasePath, settingsPath);
        statusConsole.updateInference(modelRuntime.status());
        std::string payload;
        while (readFrame(std::cin, jsonLines, payload)) {
            statusConsole.markConnected();
            try {
                const std::string response = handleRequest(
                    database, modelRuntime, payload, executablePath, databasePath, settingsPath, displayLanguage);
                statusConsole.updateInference(modelRuntime.status());
                writeFrame(std::cout, jsonLines, response);
            }
            catch (const std::exception& error) {
                statusConsole.updateInference(modelRuntime.status());
                writeFrame(std::cout, jsonLines, errorResponse(error));
            }
            if (payload.capacity() > 256U * 1024U) std::string{}.swap(payload);
        }
        return 0;
    }
    catch (const std::exception& error) {
        std::cerr << "eversoul-native-host: " << error.what() << '\n';
        return 1;
    }
}
