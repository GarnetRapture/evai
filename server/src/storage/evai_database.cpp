#include "storage/evai_database.hpp"

#include "http/http_response.hpp"
#include "storage/sqlite_database.hpp"
#include "storage/store_schema.hpp"

#include <cstddef>
#include <cstdint>
#include <exception>
#include <filesystem>
#include <format>
#include <mutex>
#include <optional>
#include <span>
#include <stdexcept>
#include <string>
#include <string_view>
#include <system_error>
#include <unordered_map>
#include <vector>

namespace evai::server::storage {

namespace {

constexpr std::string_view singleton_key_json = "[\"current\"]";

struct JsonValue {
    bool present;
    std::string text;
    std::string type;
};

StorageResponse error_response(int status_code, std::string_view error, std::string_view detail)
{
    return StorageResponse{status_code, http::json_error_body(error, detail)};
}

int sqlite_failure_status(std::string_view message)
{
    return message.find("constraint") == std::string_view::npos ? 400 : 409;
}

JsonValue read_json_value(SqliteDatabase& database, std::string_view body, std::string_view path)
{
    SqliteStatement statement = database.prepare(std::format("SELECT json_extract(?1, '{}'), json_type(?1, '{}')", path, path));
    statement.bind_text(1, body);
    if (!statement.step()) {
        return JsonValue{false, {}, {}};
    }
    if (statement.column_is_null(1)) {
        return JsonValue{false, {}, {}};
    }
    return JsonValue{!statement.column_is_null(0), statement.column_text(0), statement.column_text(1)};
}

std::optional<std::size_t> read_json_array_length(SqliteDatabase& database, std::string_view array_text)
{
    SqliteStatement statement = database.prepare("SELECT json_array_length(?1)");
    statement.bind_text(1, array_text);
    if (!statement.step() || statement.column_is_null(0)) {
        return std::nullopt;
    }
    return static_cast<std::size_t>(statement.column_integer(0));
}

struct ParsedQuery {
    QueryPlan plan;
    std::string lower;
    std::string upper;
    std::string only;
};

std::string describe_exception(const std::exception& error)
{
    return std::string(error.what());
}

}

EvaiDatabase::EvaiDatabase(const std::filesystem::path& file)
    : database_(file)
{
    apply_evai_schema(database_);
}

DatabaseSummary EvaiDatabase::read_summary()
{
    const std::lock_guard<std::mutex> lock(mutex_);
    SqliteStatement version = database_.prepare("SELECT meta_value FROM schema_meta WHERE meta_key = 'schema_version'");
    DatabaseSummary summary{version.step() ? version.column_text(0) : std::string{}, 0};
    for (const StoreDescriptor& descriptor : store_descriptors()) {
        SqliteStatement statement = database_.prepare(std::format("SELECT count(*) FROM {}", descriptor.table));
        summary.record_count += statement.step() ? statement.column_integer(0) : 0;
    }
    return summary;
}

std::optional<std::string> EvaiDatabase::read_ollama_base_url()
{
    const std::lock_guard<std::mutex> lock(mutex_);
    SqliteStatement statement = database_.prepare("SELECT ollama_base_url FROM app_settings WHERE slot = 'current'");
    if (!statement.step()) {
        return std::nullopt;
    }
    std::string base_url = statement.column_text(0);
    if (base_url.empty()) {
        return std::nullopt;
    }
    return base_url;
}

const std::filesystem::path& EvaiDatabase::file() const
{
    return database_.file();
}

StorageResponse EvaiDatabase::read_document(std::string_view request_body)
{
    const std::lock_guard<std::mutex> lock(mutex_);
    try {
        const JsonValue store = read_json_value(database_, request_body, "$.store");
        if (!store.present) {
            return error_response(400, "invalid_request", "store is required");
        }
        const StoreDescriptor* descriptor = find_store_descriptor(store.text);
        if (descriptor == nullptr) {
            return error_response(400, "unknown_store", store.text);
        }
        const JsonValue key = read_json_value(database_, request_body, "$.key");
        if (!key.present || key.type != "array") {
            return error_response(400, "invalid_request", "key must be an array");
        }
        SqliteStatement statement = database_.prepare(build_get_sql(*descriptor));
        statement.bind_text(1, key.text);
        if (!statement.step()) {
            return StorageResponse{200, "{\"found\":false}"};
        }
        return StorageResponse{200, std::format("{{\"found\":true,\"document\":{}}}", statement.column_text(0))};
    }
    catch (const std::exception& error) {
        const std::string detail = describe_exception(error);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
}

namespace {

std::optional<ParsedQuery> parse_query(SqliteDatabase& database, std::string_view request_body, std::string& failure)
{
    const JsonValue store = read_json_value(database, request_body, "$.store");
    if (!store.present) {
        failure = "store is required";
        return std::nullopt;
    }
    const StoreDescriptor* descriptor = find_store_descriptor(store.text);
    if (descriptor == nullptr) {
        failure = std::format("unknown store {}", store.text);
        return std::nullopt;
    }
    const JsonValue index_name = read_json_value(database, request_body, "$.index");
    const StoreIndex* index = nullptr;
    if (index_name.present) {
        index = find_store_index(*descriptor, index_name.text);
        if (index == nullptr) {
            failure = std::format("unknown index {}", index_name.text);
            return std::nullopt;
        }
    }
    const JsonValue direction = read_json_value(database, request_body, "$.direction");
    const JsonValue keys_only = read_json_value(database, request_body, "$.keys_only");
    const JsonValue only = read_json_value(database, request_body, "$.range.only");
    const JsonValue lower = read_json_value(database, request_body, "$.range.lower");
    const JsonValue upper = read_json_value(database, request_body, "$.range.upper");
    const JsonValue lower_open = read_json_value(database, request_body, "$.range.lower_open");
    const JsonValue upper_open = read_json_value(database, request_body, "$.range.upper_open");
    ParsedQuery parsed{
        QueryPlan{
            descriptor,
            index,
            RangeKind::all,
            lower_open.present && lower_open.text == "1",
            upper_open.present && upper_open.text == "1",
            direction.present && direction.text == "prev" ? QueryDirection::descending : QueryDirection::ascending,
            keys_only.present && keys_only.text == "1",
        },
        {},
        {},
        {},
    };
    const std::size_t component_count = index == nullptr ? descriptor->primary_columns.size() : index->columns.size();
    const auto validate_components = [&](const JsonValue& value) {
        if (value.type != "array") {
            failure = "range keys must be arrays";
            return false;
        }
        const std::optional<std::size_t> length = read_json_array_length(database, value.text);
        if (!length.has_value() || *length != component_count) {
            failure = std::format("range key must hold {} components", component_count);
            return false;
        }
        return true;
    };
    if (only.present) {
        if (!validate_components(only)) {
            return std::nullopt;
        }
        parsed.plan.range_kind = RangeKind::only;
        parsed.only = only.text;
        return parsed;
    }
    if (lower.present || upper.present) {
        if (!lower.present || !upper.present) {
            failure = "range requires both lower and upper";
            return std::nullopt;
        }
        if (!validate_components(lower) || !validate_components(upper)) {
            return std::nullopt;
        }
        parsed.plan.range_kind = RangeKind::bounded;
        parsed.lower = lower.text;
        parsed.upper = upper.text;
    }
    return parsed;
}

void bind_range(SqliteStatement& statement, const ParsedQuery& parsed)
{
    if (parsed.plan.range_kind == RangeKind::only) {
        statement.bind_text(1, parsed.only);
        return;
    }
    if (parsed.plan.range_kind == RangeKind::bounded) {
        statement.bind_text(1, parsed.lower);
        statement.bind_text(2, parsed.upper);
    }
}

}

StorageResponse EvaiDatabase::query_entries(std::string_view request_body)
{
    const std::lock_guard<std::mutex> lock(mutex_);
    try {
        std::string failure;
        const std::optional<ParsedQuery> parsed = parse_query(database_, request_body, failure);
        if (!parsed.has_value()) {
            return error_response(400, "invalid_request", failure);
        }
        SqliteStatement statement = database_.prepare(build_query_sql(parsed->plan));
        bind_range(statement, *parsed);
        std::string entries;
        while (statement.step()) {
            if (!entries.empty()) {
                entries += ',';
            }
            entries += std::format("{{\"key\":{},\"primary_key\":{}", statement.column_text(0), statement.column_text(1));
            if (!parsed->plan.keys_only) {
                entries += std::format(",\"document\":{}", statement.column_text(2));
            }
            entries += '}';
        }
        return StorageResponse{200, std::format("{{\"entries\":[{}]}}", entries)};
    }
    catch (const std::exception& error) {
        const std::string detail = describe_exception(error);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
}

StorageResponse EvaiDatabase::count_entries(std::string_view request_body)
{
    const std::lock_guard<std::mutex> lock(mutex_);
    try {
        std::string failure;
        const std::optional<ParsedQuery> parsed = parse_query(database_, request_body, failure);
        if (!parsed.has_value()) {
            return error_response(400, "invalid_request", failure);
        }
        SqliteStatement statement = database_.prepare(build_count_sql(parsed->plan));
        bind_range(statement, *parsed);
        const std::int64_t count = statement.step() ? statement.column_integer(0) : 0;
        return StorageResponse{200, std::format("{{\"count\":{}}}", count)};
    }
    catch (const std::exception& error) {
        const std::string detail = describe_exception(error);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
}

namespace {

SqliteStatement& cached_statement(
    SqliteDatabase& database,
    std::unordered_map<std::string, SqliteStatement>& cache,
    const std::string& cache_key,
    const std::string& sql)
{
    const auto existing = cache.find(cache_key);
    if (existing != cache.end()) {
        existing->second.reset();
        return existing->second;
    }
    return cache.emplace(cache_key, database.prepare(sql)).first->second;
}

void apply_write(
    SqliteDatabase& database,
    std::unordered_map<std::string, SqliteStatement>& cache,
    const StoreDescriptor& descriptor,
    std::string_view operation,
    std::string_view element,
    std::string_view key_text)
{
    if (operation == "clear") {
        SqliteStatement& statement = cached_statement(database, cache, std::format("{}|clear", descriptor.store), build_clear_sql(descriptor));
        statement.run();
        return;
    }
    if (operation == "delete") {
        if (key_text.empty()) {
            throw std::runtime_error("delete requires a key");
        }
        SqliteStatement& statement = cached_statement(database, cache, std::format("{}|delete", descriptor.store), build_delete_sql(descriptor));
        statement.bind_text(1, key_text);
        statement.run();
        return;
    }
    if (operation != "put" && operation != "add") {
        throw std::runtime_error(std::format("unknown write operation {}", operation));
    }
    const bool insert_only = operation == "add";
    SqliteStatement& statement = cached_statement(
        database,
        cache,
        std::format("{}|{}", descriptor.store, operation),
        build_put_sql(descriptor, insert_only));
    statement.bind_text(1, element);
    statement.run();
    if (!descriptor.source_message_links) {
        return;
    }
    SqliteStatement& link_delete = cached_statement(database, cache, "links|delete", build_link_delete_sql());
    link_delete.bind_text(1, element);
    link_delete.run();
    SqliteStatement& link_insert = cached_statement(database, cache, "links|insert", build_link_insert_sql());
    link_insert.bind_text(1, element);
    link_insert.run();
}

}

StorageResponse EvaiDatabase::commit_writes(std::string_view request_body)
{
    const std::lock_guard<std::mutex> lock(mutex_);
    std::unordered_map<std::string, SqliteStatement> cache;
    database_.execute("BEGIN IMMEDIATE");
    try {
        SqliteStatement writes = database_.prepare(
            "SELECT value, json_extract(value, '$.op'), json_extract(value, '$.store'), json_extract(value, '$.key') "
            "FROM json_each(?1, '$.writes')");
        writes.bind_text(1, request_body);
        std::int64_t applied = 0;
        while (writes.step()) {
            const std::string element = writes.column_text(0);
            const std::string operation = writes.column_text(1);
            const std::string store = writes.column_text(2);
            const std::string key_text = writes.column_is_null(3) ? std::string{} : writes.column_text(3);
            const StoreDescriptor* descriptor = find_store_descriptor(store);
            if (descriptor == nullptr) {
                throw std::runtime_error(std::format("unknown store {}", store));
            }
            apply_write(database_, cache, *descriptor, operation, element, key_text);
            applied += 1;
        }
        cache.clear();
        database_.execute("COMMIT");
        return StorageResponse{200, std::format("{{\"written\":{}}}", applied)};
    }
    catch (const std::exception& error) {
        cache.clear();
        database_.execute("ROLLBACK");
        const std::string detail = describe_exception(error);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
}

namespace {

constexpr std::string_view clear_order[] = {
    "DELETE FROM persona_memory_source_message",
    "DELETE FROM persona_memory",
    "DELETE FROM chat_message",
    "DELETE FROM chat_room",
    "DELETE FROM persona_localized_prompt",
    "DELETE FROM persona",
    "DELETE FROM style_profile",
    "DELETE FROM knowledge_chunk",
    "DELETE FROM sync_metadata",
    "DELETE FROM app_settings",
    "DELETE FROM auth_session",
    "DELETE FROM imported_module",
};

constexpr std::string_view normalization_sql[] = {
    "UPDATE chat_room SET persona_id = NULL, document = json_set(document, '$.persona_id', json('null')) "
    "WHERE persona_id IS NOT NULL AND persona_id NOT IN (SELECT id FROM persona)",
    "DELETE FROM chat_message WHERE room_id NOT IN (SELECT id FROM chat_room)",
    "UPDATE chat_message SET persona_id = NULL, document = json_set(document, '$.persona_id', json('null')) "
    "WHERE persona_id IS NOT NULL AND persona_id NOT IN (SELECT id FROM persona)",
    "DELETE FROM persona_memory WHERE persona_id NOT IN (SELECT id FROM persona)",
    "UPDATE persona_memory SET source_room_id = NULL, document = json_remove(document, '$.source_room_id') "
    "WHERE source_room_id IS NOT NULL AND source_room_id NOT IN (SELECT id FROM chat_room)",
    "DELETE FROM persona_localized_prompt WHERE persona_id NOT IN (SELECT id FROM persona)",
    "DELETE FROM persona_memory_source_message WHERE message_id NOT IN (SELECT id FROM chat_message)",
};

}

StorageResponse EvaiDatabase::restore_snapshot(std::string_view request_body)
{
    const std::lock_guard<std::mutex> lock(mutex_);
    std::unordered_map<std::string, SqliteStatement> cache;
    database_.execute("BEGIN IMMEDIATE");
    try {
        for (const std::string_view statement_text : clear_order) {
            database_.execute(statement_text);
        }
        std::int64_t restored = 0;
        for (const std::string_view store : restore_store_order()) {
            const StoreDescriptor* descriptor = find_store_descriptor(store);
            if (descriptor == nullptr) {
                throw std::runtime_error(std::format("unknown store {}", store));
            }
            const std::string element_sql = descriptor->inline_key
                ? std::format("SELECT json_object('document', value) FROM json_each(?1, '$.stores.{}')", store)
                : std::format("SELECT json_object('document', value, 'key', json_array('current')) FROM json_each(?1, '$.stores.{}')", store);
            SqliteStatement records = database_.prepare(element_sql);
            records.bind_text(1, request_body);
            while (records.step()) {
                const std::string element = records.column_text(0);
                apply_write(database_, cache, *descriptor, "put", element, singleton_key_json);
                restored += 1;
            }
        }
        std::int64_t normalized = 0;
        for (const std::string_view statement_text : normalization_sql) {
            database_.execute(statement_text);
            normalized += database_.changes();
        }
        cache.clear();
        database_.execute("COMMIT");
        return StorageResponse{200, std::format("{{\"restored\":{},\"normalized\":{}}}", restored, normalized)};
    }
    catch (const std::exception& error) {
        cache.clear();
        database_.execute("ROLLBACK");
        const std::string detail = describe_exception(error);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
}

StorageResponse EvaiDatabase::reset_storage()
{
    const std::lock_guard<std::mutex> lock(mutex_);
    database_.execute("BEGIN IMMEDIATE");
    try {
        for (const std::string_view statement_text : clear_order) {
            database_.execute(statement_text);
        }
        database_.execute("COMMIT");
    }
    catch (const std::exception& error) {
        database_.execute("ROLLBACK");
        const std::string detail = describe_exception(error);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
    database_.execute("PRAGMA wal_checkpoint(TRUNCATE)");
    database_.execute("VACUUM");
    return StorageResponse{200, "{\"cleared\":true}"};
}

namespace {

constexpr std::string_view link_table_name = "persona_memory_source_message";

constexpr std::string_view schema_object_detail_sql = R"sql(
SELECT json_object(
    'name', ?1,
    'type', ?2,
    'definition', ?3,
    'store', ?4,
    'row_count', CAST(?5 AS INTEGER),
    'columns', (
        SELECT json_group_array(json_object(
            'name', name,
            'type', type,
            'not_null', "notnull",
            'default_value', coalesce(dflt_value, ''),
            'primary_key', pk))
        FROM pragma_table_info(?1)),
    'indexes', (
        SELECT json_group_array(json_object(
            'name', listing.name,
            'unique', listing."unique",
            'origin', listing.origin,
            'partial', listing.partial,
            'columns', (
                SELECT json_group_array(coalesce(info.name, ''))
                FROM pragma_index_info(listing.name) AS info)))
        FROM pragma_index_list(?1) AS listing),
    'foreign_keys', (
        SELECT json_group_array(json_object(
            'column', "from",
            'references_table', "table",
            'references_column', coalesce("to", ''),
            'on_delete', on_delete,
            'on_update', on_update))
        FROM pragma_foreign_key_list(?1)))
)sql";

struct SchemaObject {
    std::string name;
    std::string type;
    std::string sql;
};

std::string store_name_for_table(std::string_view table)
{
    for (const StoreDescriptor& descriptor : store_descriptors()) {
        if (descriptor.table == table) {
            return std::string(descriptor.store);
        }
    }
    return {};
}

}

StorageResponse EvaiDatabase::read_schema()
{
    const std::lock_guard<std::mutex> lock(mutex_);
    try {
        std::vector<SchemaObject> objects;
        SqliteStatement listing = database_.prepare(
            "SELECT name, type, coalesce(sql, '') FROM sqlite_schema "
            "WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' "
            "ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name");
        while (listing.step()) {
            objects.push_back(SchemaObject{listing.column_text(0), listing.column_text(1), listing.column_text(2)});
        }
        std::string tables;
        std::int64_t link_rows = 0;
        for (const SchemaObject& object : objects) {
            SqliteStatement counter = database_.prepare(std::format("SELECT count(*) FROM \"{}\"", object.name));
            const std::int64_t rows = counter.step() ? counter.column_integer(0) : 0;
            if (object.name == link_table_name) {
                link_rows = rows;
            }
            SqliteStatement details = database_.prepare(schema_object_detail_sql);
            details.bind_text(1, object.name);
            details.bind_text(2, object.type);
            details.bind_text(3, object.sql);
            details.bind_text(4, store_name_for_table(object.name));
            details.bind_text(5, std::to_string(rows));
            if (!details.step()) {
                throw std::runtime_error(std::format("schema detail unavailable for {}", object.name));
            }
            if (!tables.empty()) {
                tables += ',';
            }
            tables += details.column_text(0);
        }
        SqliteStatement version = database_.prepare("SELECT meta_value FROM schema_meta WHERE meta_key = 'schema_version'");
        const std::string schema_version = version.step() ? version.column_text(0) : std::string{};
        return StorageResponse{200, std::format(
            "{{\"schema_version\":\"{}\",\"sqlite_version\":\"{}\",\"link_row_count\":{},\"tables\":[{}]}}",
            http::json_escaped(schema_version),
            http::json_escaped(sqlite_library_version()),
            link_rows,
            tables)};
    }
    catch (const std::exception& error) {
        const std::string detail = describe_exception(error);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
}

StorageResponse EvaiDatabase::read_status()
{
    const std::lock_guard<std::mutex> lock(mutex_);
    try {
        std::string counts;
        for (const StoreDescriptor& descriptor : store_descriptors()) {
            SqliteStatement statement = database_.prepare(std::format("SELECT count(*) FROM {}", descriptor.table));
            const std::int64_t count = statement.step() ? statement.column_integer(0) : 0;
            if (!counts.empty()) {
                counts += ',';
            }
            counts += std::format("\"{}\":{}", descriptor.store, count);
        }
        std::error_code size_error;
        const std::uintmax_t file_bytes = std::filesystem::file_size(database_.file(), size_error);
        const std::string path_text = http::json_escaped(database_.file().string());
        return StorageResponse{200, std::format(
            "{{\"database_path\":\"{}\",\"database_bytes\":{},\"stores\":{{{}}}}}",
            path_text,
            size_error ? 0 : file_bytes,
            counts)};
    }
    catch (const std::exception& error) {
        const std::string detail = describe_exception(error);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
}

void apply_evai_schema(SqliteDatabase& database)
{
    database.execute(evai_schema_sql());
    SqliteStatement statement = database.prepare("INSERT INTO schema_meta (meta_key, meta_value) VALUES ('schema_version', ?1) "
                                                 "ON CONFLICT (meta_key) DO UPDATE SET meta_value = excluded.meta_value");
    statement.bind_text(1, evai_schema_version());
    statement.run();
}

void create_evai_database(const std::filesystem::path& file)
{
    if (file.has_parent_path()) {
        std::filesystem::create_directories(file.parent_path());
    }
    SqliteDatabase database(file);
    apply_evai_schema(database);
    database.execute("PRAGMA wal_checkpoint(TRUNCATE)");
    database.execute("VACUUM");
}

}
