#include "app/server_options.hpp"
#include "net/socket_runtime.hpp"
#include "net/tcp_socket.hpp"
#include "platform/executable_directory.hpp"
#include "site/static_site.hpp"

#include <exception>
#include <filesystem>
#include <iostream>
#include <memory>
#include <string_view>
#include <thread>
#include <utility>
#include <vector>

namespace {

int run_server(const std::vector<std::string_view>& arguments)
{
    const evai::server::app::ServerOptions options = evai::server::app::parse_server_options(arguments);
    const std::filesystem::path root = evai::server::platform::resolve_executable_directory();
    if (!std::filesystem::is_regular_file(root / "index.html")) {
        std::cerr << "index.html not found next to the executable: " << root.string() << '\n';
        return 1;
    }
    const evai::server::net::SocketRuntime socket_runtime;
    const auto context = std::make_shared<const evai::server::site::StaticSiteContext>(
        evai::server::site::create_static_site_context(root, options.port));
    const evai::server::net::TcpSocket listener = evai::server::net::TcpSocket::listen_loopback(options.port);
    std::cout << "EVAI local server\n"
              << "root: " << context->root_directory.string() << '\n'
              << "open: http://127.0.0.1:" << options.port << "/\n"
              << "close this window to stop the server.\n"
              << std::flush;
    for (;;) {
        evai::server::net::TcpSocket client = listener.accept_client();
        if (!client.valid()) {
            continue;
        }
        std::thread([connection = std::move(client), context]() mutable {
            evai::server::site::serve_static_site_connection(std::move(connection), *context);
        }).detach();
    }
}

}

int main(int argc, char** argv)
{
    try {
        return run_server(std::vector<std::string_view>(argv + 1, argv + argc));
    }
    catch (const std::exception& error) {
        std::cerr << "server error: " << error.what() << '\n';
        return 1;
    }
}
