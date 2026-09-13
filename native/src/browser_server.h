#pragma once

#include <cstdint>
#include <filesystem>
#include <memory>
#include <string>

#include "local_request_channel.h"

namespace eversoul::native {

struct BrowserServerConfiguration {
    std::uint16_t port = 47831;
    std::filesystem::path webRoot;
    // Set to the externally served HTTPS origin when using a reverse proxy.
    std::string publicOrigin;
};

class BrowserServer {
public:
    BrowserServer(BrowserServerConfiguration configuration, LocalRequestHandler handler);
    ~BrowserServer();
    BrowserServer(const BrowserServer&) = delete;
    BrowserServer& operator=(const BrowserServer&) = delete;
private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};

}
