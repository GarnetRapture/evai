#pragma once

#include <cstdint>
#include <filesystem>
#include <functional>
#include <memory>
#include <string>
#include <string_view>

namespace eversoul::native {

using LocalRequestHandler = std::function<std::string(std::string_view)>;

[[nodiscard]] std::string localRequestEndpoint(const std::filesystem::path& executablePath);

class LocalRequestServer {
public:
    LocalRequestServer(std::string endpoint, LocalRequestHandler handler);
    ~LocalRequestServer();

    LocalRequestServer(const LocalRequestServer&) = delete;
    LocalRequestServer& operator=(const LocalRequestServer&) = delete;

private:
    struct State;
    std::shared_ptr<State> state_;
};

class LocalRequestClient {
public:
    [[nodiscard]] static std::unique_ptr<LocalRequestClient> connect(const std::string& endpoint, std::string& error);
    ~LocalRequestClient();

    LocalRequestClient(const LocalRequestClient&) = delete;
    LocalRequestClient& operator=(const LocalRequestClient&) = delete;

    [[nodiscard]] std::string exchange(std::string_view requestLine);

private:
    explicit LocalRequestClient(std::intptr_t handle) noexcept;

    std::intptr_t handle_;
    std::string buffer_;
};

}
