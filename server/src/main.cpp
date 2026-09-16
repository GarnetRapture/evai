#include "api/ollama_proxy.hpp"
#include "app/console_ui.hpp"
#include "app/error_log.hpp"
#include "app/http_service.hpp"
#include "app/server_config.hpp"
#include "app/server_options.hpp"
#include "net/socket_runtime.hpp"
#include "net/tcp_socket.hpp"
#include "platform/executable_directory.hpp"
#include "storage/backup_store.hpp"
#include "storage/evai_database.hpp"

#include <exception>
#include <filesystem>
#include <iostream>
#include <string>
#include <string_view>
#include <thread>
#include <utility>
#include <vector>

namespace {

int create_database(const evai::server::app::ServerOptions& options)
{
    const std::filesystem::path file(options.database_path);
    evai::server::storage::create_evai_database(file);
    std::cout << file.string() << '\n' << std::flush;
    return 0;
}

evai::server::app::ServerConfig resolve_config(const std::filesystem::path& file)
{
    evai::server::app::ServerConfig config = evai::server::app::read_server_config(file);
    if (!config.language_configured) {
        config.language = evai::server::app::choose_console_language();
        config.language_configured = true;
        evai::server::app::write_server_config(file, config);
    }
    return config;
}

int run_server(const evai::server::app::ServerOptions& options)
{
    evai::server::app::prepare_console();
    const std::filesystem::path root = evai::server::platform::resolve_executable_directory();
    const std::filesystem::path config_file = root / evai::server::app::config_file_name;
    evai::server::app::configure_error_log(root / evai::server::app::error_log_file_name);
    const evai::server::app::ServerConfig config = resolve_config(config_file);
    if (!std::filesystem::is_regular_file(root / "index.html")) {
        const std::string detail = "index.html not found next to the executable: " + root.string();
        evai::server::app::print_startup_failure(config.language, detail);
        evai::server::app::record_error("startup", detail);
        evai::server::platform::wait_for_console_close();
        return 1;
    }
    const std::filesystem::path database_directory = root / evai::server::app::database_directory_name;
    const std::filesystem::path database_file = database_directory / evai::server::app::database_file_name;
    if (!std::filesystem::is_regular_file(database_file)) {
        evai::server::storage::create_evai_database(database_file);
    }
    evai::server::storage::EvaiDatabase database(database_file);
    const evai::server::storage::DatabaseSummary summary = database.read_summary();
    evai::server::storage::BackupStore backups(root / evai::server::storage::backup_directory_name);
    const evai::server::net::SocketRuntime socket_runtime;
    const evai::server::app::HttpServiceContext context = evai::server::app::create_http_service_context(root, database_directory, database, backups, options.port);
    const evai::server::net::TcpSocket listener = evai::server::net::TcpSocket::listen_loopback(options.port);
    const std::string ollama_base_url = evai::server::api::resolve_ollama_base_url(database.read_ollama_base_url());
    const evai::server::api::OllamaProbe ollama = evai::server::api::probe_ollama(ollama_base_url);
    evai::server::app::print_status_report(config.language, {
        context.site.root_directory,
        database.file(),
        summary.record_count,
        ollama_base_url,
        ollama.available,
        ollama.detail,
        options.port,
    });
    evai::server::app::print_config_location(config.language, config_file);
    for (;;) {
        evai::server::net::TcpSocket client = listener.accept_client();
        if (!client.valid()) {
            continue;
        }
        std::thread([connection = std::move(client), &context]() mutable {
            evai::server::app::serve_http_connection(std::move(connection), context);
        }).detach();
    }
}

int run(const std::vector<std::string_view>& arguments)
{
    const evai::server::app::ServerOptions options = evai::server::app::parse_server_options(arguments);
    return options.run_mode == evai::server::app::ServerRunMode::create_database ? create_database(options) : run_server(options);
}

}

int main(int argc, char** argv)
{
    try {
        return run(std::vector<std::string_view>(argv + 1, argv + argc));
    }
    catch (const std::exception& error) {
        std::cerr << "server error: " << error.what() << '\n';
        evai::server::app::record_error("server", error.what());
        evai::server::platform::wait_for_console_close();
        return 1;
    }
}
