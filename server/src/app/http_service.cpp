#include "app/http_service.hpp"

#include "api/ollama_proxy.hpp"
#include "app/error_log.hpp"
#include "app/server_config.hpp"
#include "http/http_request.hpp"
#include "http/http_response.hpp"
#include "http/http_writer.hpp"
#include "net/tcp_socket.hpp"
#include "site/static_site.hpp"
#include "storage/evai_database.hpp"
#include "storage/sqlite_database.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <exception>
#include <format>
#include <iostream>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace evai::server::app
{

namespace
{

constexpr std::string_view runtime_path = "/api/runtime";
constexpr std::string_view storage_prefix = "/api/storage/";
constexpr std::string_view backup_prefix = "/api/backup/";
constexpr std::string_view api_prefix = "/api/";
constexpr std::string_view json_content_type_prefix = "application/json";
constexpr std::size_t receive_chunk_bytes = 16 * 1024;
constexpr std::string_view service_version = EVAI_SERVER_VERSION;

enum class ReceiveOutcome
{
    request,
    closed,
    rejected,
};

struct ReceivedRequest
{
    ReceiveOutcome outcome;
    http::HttpRequest request;
    int failure_status;
    std::string_view failure_reason;
};

ReceivedRequest rejected_request(int status, std::string_view reason)
{
    return ReceivedRequest{ReceiveOutcome::rejected, {}, status, reason};
}

class RequestReader
{
public:
    explicit RequestReader(const net::TcpSocket &client)
        : client_(&client)
    {
    }

    ReceivedRequest next()
    {
        std::size_t search_from = 0;
        std::size_t header_end = std::string::npos;
        while (header_end == std::string::npos)
        {
            while (buffer_.starts_with(http::http_line_separator))
            {
                buffer_.erase(0, http::http_line_separator.size());
                search_from = 0;
            }
            const auto terminator = buffer_.find(http::http_header_terminator, search_from);
            if (terminator != std::string::npos)
            {
                header_end = terminator + http::http_header_terminator.size();
                break;
            }
            if (buffer_.size() >= http::http_header_limit_bytes)
            {
                return rejected_request(400, "Bad Request");
            }
            search_from = buffer_.size() < http::http_header_terminator.size()
                              ? 0
                              : buffer_.size() - http::http_header_terminator.size() + 1;
            if (!receive_more())
            {
                return buffer_.empty() ? ReceivedRequest{ReceiveOutcome::closed, {}, 0, {}}
                                       : rejected_request(400, "Bad Request");
            }
        }
        std::optional<http::HttpRequest> request =
            http::parse_http_request(std::string_view(buffer_).substr(0, header_end));
        if (!request)
        {
            return rejected_request(400, "Bad Request");
        }
        if (!request->header("Transfer-Encoding").empty())
        {
            return rejected_request(411, "Length Required");
        }
        const std::string_view content_length_header = request->header("Content-Length");
        std::size_t content_length = 0;
        if (!content_length_header.empty())
        {
            const std::optional<std::size_t> parsed_length = http::parse_content_length(content_length_header);
            if (!parsed_length)
            {
                return rejected_request(400, "Bad Request");
            }
            if (*parsed_length > http::http_body_limit_bytes)
            {
                return rejected_request(413, "Payload Too Large");
            }
            content_length = *parsed_length;
        }
        const std::size_t message_end = header_end + content_length;
        buffer_.reserve(message_end);
        while (buffer_.size() < message_end)
        {
            if (!receive_more())
            {
                return rejected_request(400, "Bad Request");
            }
        }
        if (buffer_.size() == message_end)
        {
            buffer_.erase(0, header_end);
            request->body = std::move(buffer_);
            buffer_.clear();
        }
        else
        {
            request->body = buffer_.substr(header_end, content_length);
            buffer_.erase(0, message_end);
        }
        return ReceivedRequest{ReceiveOutcome::request, std::move(*request), 0, {}};
    }

private:
    bool receive_more()
    {
        std::array<char, receive_chunk_bytes> chunk{};
        const std::size_t received = client_->receive_some(chunk);
        if (received == 0)
        {
            return false;
        }
        buffer_.append(chunk.data(), received);
        return true;
    }

    const net::TcpSocket *client_;
    std::string buffer_;
};

bool is_allowed_origin(const HttpServiceContext &context, std::string_view origin)
{
    return origin.empty() || std::ranges::find(context.allowed_origins, origin) != context.allowed_origins.end();
}

std::string runtime_body(const HttpServiceContext &context)
{
    const ServerConfig config = read_server_config(context.config_file);
    return std::format(
        "{{\"service\":\"evai-local-server\",\"version\":\"{}\",\"storage\":\"sqlite\",\"sqlite_version\":\"{}\","
        "\"database_path\":\"{}\",\"ollama_proxy_path\":\"{}\",\"port\":{},\"bgm\":{},\"voice\":\"{}\"}}",
        http::json_escaped(service_version), http::json_escaped(storage::sqlite_library_version()),
        http::json_escaped(context.database->file().string()), http::json_escaped(api::ollama_proxy_prefix),
        context.port, config.bgm ? "true" : "false", voice_code(config.voice));
}

bool parse_json_flag(std::string_view body, std::string_view key, bool &value)
{
    const std::string needle = std::format("\"{}\"", key);
    const auto found = body.find(needle);
    if (found == std::string_view::npos)
    {
        return false;
    }
    const auto colon = body.find(':', found + needle.size());
    if (colon == std::string_view::npos)
    {
        return false;
    }
    const auto start = body.find_first_not_of(" \t\r\n", colon + 1);
    if (start == std::string_view::npos)
    {
        return false;
    }
    if (body.compare(start, 4, "true") == 0)
    {
        value = true;
        return true;
    }
    if (body.compare(start, 5, "false") == 0)
    {
        value = false;
        return true;
    }
    return false;
}

void handle_runtime_update(const http::HttpChannel &channel, const HttpServiceContext &context,
                           const http::HttpRequest &request)
{
    ServerConfig config = read_server_config(context.config_file);
    bool bgm = config.bgm;
    if (!parse_json_flag(request.body, "bgm", bgm))
    {
        http::send_json(channel, 400, "Bad Request", http::json_error_body("invalid_body", "bgm"));
        return;
    }
    config.bgm = bgm;
    config.bgm_configured = true;
    write_server_config(context.config_file, config);
    http::send_json(channel, 200, "OK", runtime_body(context));
}

void handle_storage_request(const http::HttpChannel &channel, const HttpServiceContext &context, std::string_view operation,
                            const http::HttpRequest &request)
{
    if (operation == "status" && request.method == "GET")
    {
        const storage::StorageResponse response = context.database->read_status();
        http::send_json(channel, response.status_code, response.status_code == 200 ? "OK" : "Bad Request",
                        response.body);
        return;
    }
    if (operation == "schema" && request.method == "GET")
    {
        const storage::StorageResponse response = context.database->read_schema();
        http::send_json(channel, response.status_code, response.status_code == 200 ? "OK" : "Bad Request",
                        response.body);
        return;
    }
    if (request.method != "POST")
    {
        http::send_json(channel, 405, "Method Not Allowed", http::json_error_body("method_not_allowed", request.method));
        return;
    }
    if (!request.header("Content-Type").starts_with(json_content_type_prefix))
    {
        http::send_json(channel, 415, "Unsupported Media Type",
                        http::json_error_body("unsupported_media_type", request.header("Content-Type")));
        return;
    }
    const storage::StorageResponse response = [&]() {
        if (operation == "get")
        {
            return context.database->read_document(request.body);
        }
        if (operation == "query")
        {
            return context.database->query_entries(request.body);
        }
        if (operation == "count")
        {
            return context.database->count_entries(request.body);
        }
        if (operation == "commit")
        {
            return context.database->commit_writes(request.body);
        }
        if (operation == "restore")
        {
            return context.database->restore_snapshot(request.body);
        }
        if (operation == "reset")
        {
            return context.database->reset_storage();
        }
        return storage::StorageResponse{404, http::json_error_body("unknown_operation", operation)};
    }();
    http::send_json(channel, response.status_code, response.status_code == 200 ? "OK" : "Bad Request", response.body);
}

void handle_backup_request(const http::HttpChannel &channel, const HttpServiceContext &context, std::string_view operation,
                           const http::HttpRequest &request)
{
    if (operation == "list" && request.method == "GET")
    {
        const storage::BackupResponse response = context.backups->list_files();
        http::send_json(channel, response.status_code, response.status_code == 200 ? "OK" : "Bad Request",
                        response.body);
        return;
    }
    if (operation == "create" && request.method == "POST")
    {
        const storage::MaintenanceLease lease = context.database->lock_for_maintenance();
        const storage::BackupResponse response = context.backups->create_backup();
        http::send_json(channel, response.status_code, response.status_code == 200 ? "OK" : "Bad Request",
                        response.body);
        return;
    }
    if (request.method != "POST")
    {
        http::send_json(channel, 405, "Method Not Allowed", http::json_error_body("method_not_allowed", request.method));
        return;
    }
    if (!request.header("Content-Type").starts_with(json_content_type_prefix))
    {
        http::send_json(channel, 415, "Unsupported Media Type",
                        http::json_error_body("unsupported_media_type", request.header("Content-Type")));
        return;
    }
    const storage::BackupResponse response = [&]() {
        if (operation == "restore")
        {
            const storage::MaintenanceLease lease = context.database->lock_for_maintenance();
            return context.backups->restore_backup(request.body);
        }
        if (operation == "delete")
        {
            return context.backups->remove_file(request.body);
        }
        return storage::BackupResponse{404, http::json_error_body("unknown_operation", operation)};
    }();
    http::send_json(channel, response.status_code, response.status_code == 200 ? "OK" : "Bad Request", response.body);
}

http::ConnectionPersistence handle_request(const http::HttpChannel &channel, const HttpServiceContext &context,
                                           const http::HttpRequest &request)
{
    if (std::ranges::find(context.allowed_hosts, request.host) == context.allowed_hosts.end())
    {
        http::send_status_text({channel.socket, http::ConnectionPersistence::close}, 403, "Forbidden");
        return http::ConnectionPersistence::close;
    }
    const std::optional<std::string> path = http::decode_request_path(request.target);
    if (!path)
    {
        http::send_status_text(channel, 400, "Bad Request");
        return channel.persistence;
    }
    if (path->starts_with(api_prefix))
    {
        if (!is_allowed_origin(context, request.header("Origin")))
        {
            http::send_json(channel, 403, "Forbidden",
                            http::json_error_body("forbidden_origin", request.header("Origin")));
            return channel.persistence;
        }
        if (*path == runtime_path)
        {
            if (request.method == "PUT" || request.method == "POST")
            {
                handle_runtime_update(channel, context, request);
                return channel.persistence;
            }
            http::send_json(channel, 200, "OK", runtime_body(context));
            return channel.persistence;
        }
        if (path->starts_with(storage_prefix))
        {
            handle_storage_request(channel, context, std::string_view(*path).substr(storage_prefix.size()), request);
            return channel.persistence;
        }
        if (path->starts_with(backup_prefix))
        {
            handle_backup_request(channel, context, std::string_view(*path).substr(backup_prefix.size()), request);
            return channel.persistence;
        }
        if (path->starts_with(api::ollama_proxy_prefix))
        {
            const std::string_view target = request.target;
            const std::string base_url = api::resolve_ollama_base_url(context.database->read_ollama_base_url());
            api::proxy_ollama_request({channel.socket, http::ConnectionPersistence::close}, request, base_url,
                                      target.substr(api::ollama_proxy_prefix.size()));
            return http::ConnectionPersistence::close;
        }
        http::send_json(channel, 404, "Not Found", http::json_error_body("unknown_endpoint", *path));
        return channel.persistence;
    }
    const bool is_head = request.method == "HEAD";
    if (request.method != "GET" && !is_head)
    {
        http::send_status_text(channel, 405, "Method Not Allowed");
        return channel.persistence;
    }
    site::serve_static_file(channel, context.site, *path, !is_head);
    return channel.persistence;
}

} // namespace

HttpServiceContext create_http_service_context(const std::filesystem::path &root_directory,
                                               const std::filesystem::path &database_directory,
                                               storage::EvaiDatabase &database, storage::BackupStore &backups,
                                               std::uint16_t port, const std::filesystem::path &config_file)
{
    return HttpServiceContext{
        site::create_static_site_context(root_directory, database_directory),
        &database,
        &backups,
        {std::format("127.0.0.1:{}", port), std::format("localhost:{}", port)},
        {std::format("http://127.0.0.1:{}", port), std::format("http://localhost:{}", port)},
        port,
        config_file,
    };
}

void serve_http_connection(net::TcpSocket client, const HttpServiceContext &context)
{
    try
    {
        client.set_no_delay();
        client.set_receive_timeout(http::keep_alive_idle_timeout);
        RequestReader reader(client);
        for (;;)
        {
            const ReceivedRequest received = reader.next();
            if (received.outcome == ReceiveOutcome::closed)
            {
                return;
            }
            if (received.outcome == ReceiveOutcome::rejected)
            {
                http::send_status_text({client, http::ConnectionPersistence::close}, received.failure_status,
                                       received.failure_reason);
                return;
            }
            const http::HttpChannel channel{client, received.request.keeps_connection_open()
                                                        ? http::ConnectionPersistence::keep_alive
                                                        : http::ConnectionPersistence::close};
            if (handle_request(channel, context, received.request) == http::ConnectionPersistence::close)
            {
                return;
            }
        }
    }
    catch (const std::exception &error)
    {
        std::cerr << "request failed: " << error.what() << '\n';
    }
}

} // namespace evai::server::app
