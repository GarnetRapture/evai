#include "storage/evai_database.hpp"

#include "http/http_response.hpp"
#include "storage/sqlite_database.hpp"
#include "storage/store_schema.hpp"

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <exception>
#include <filesystem>
#include <format>
#include <memory>
#include <mutex>
#include <optional>
#include <span>
#include <stdexcept>
#include <string>
#include <string_view>
#include <system_error>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

namespace evai::server::storage {

namespace {

constexpr std::string_view singleton_key_json = "[\"current\"]";

constexpr std::size_t minimum_reader_count = 2;
constexpr std::size_t maximum_reader_count = 4;

constexpr std::string_view document_request_sql =
    "SELECT json_extract(?1, '$.store'), json_extract(?1, '$.key'), json_type(?1, '$.key')";

constexpr std::size_t query_request_field_count = 15;

constexpr std::string_view query_request_sql =
    "SELECT json_extract(?1, '$.store'), json_extract(?1, '$.index'), json_extract(?1, '$.direction'),"
    " json_extract(?1, '$.keys_only'),"
    " json_type(?1, '$.range.only'), json_extract(?1, '$.range.only'), json_array_length(?1, '$.range.only'),"
    " json_type(?1, '$.range.lower'), json_extract(?1, '$.range.lower'), json_array_length(?1, '$.range.lower'),"
    " json_type(?1, '$.range.upper'), json_extract(?1, '$.range.upper'), json_array_length(?1, '$.range.upper'),"
    " json_extract(?1, '$.range.lower_open'), json_extract(?1, '$.range.upper_open')";

constexpr std::string_view commit_writes_sql =
    "SELECT value, json_extract(value, '$.op'), json_extract(value, '$.store'), json_extract(value, '$.key') "
    "FROM json_each(?1, '$.writes')";

struct JsonField {
    bool present;
    std::string text;
};

using QueryRequestFields = std::array<JsonField, query_request_field_count>;

StorageResponse error_response(int status_code, std::string_view error, std::string_view detail)
{
    return StorageResponse{status_code, http::json_error_body(error, detail)};
}

int sqlite_failure_status(std::string_view message)
{
    return message.find("constraint") == std::string_view::npos ? 400 : 409;
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

std::string plan_cache_key(std::string_view prefix, const QueryPlan& plan)
{
    return std::format(
        "{}|{}|{}|{}|{}|{}|{}|{}",
        prefix,
        plan.descriptor->store,
        plan.index == nullptr ? std::string_view{} : plan.index->name,
        static_cast<int>(plan.range_kind),
        plan.lower_open ? 1 : 0,
        plan.upper_open ? 1 : 0,
        static_cast<int>(plan.direction),
        plan.keys_only ? 1 : 0);
}

std::string rollback_failure(DatabaseConnection& connection)
{
    try {
        connection.database().execute("ROLLBACK");
        return {};
    }
    catch (const std::exception& error) {
        return std::format(" | rollback failed: {}", error.what());
    }
}

std::size_t resolve_reader_count()
{
    const unsigned int hardware = std::thread::hardware_concurrency();
    const std::size_t available = hardware == 0 ? minimum_reader_count : static_cast<std::size_t>(hardware);
    return std::clamp(available, minimum_reader_count, maximum_reader_count);
}

}

std::size_t StatementCacheHash::operator()(std::string_view key) const noexcept
{
    return std::hash<std::string_view>{}(key);
}

DatabaseConnection::DatabaseConnection(const std::filesystem::path& file)
    : database_(file)
{
}

SqliteDatabase& DatabaseConnection::database()
{
    return database_;
}

const std::filesystem::path& DatabaseConnection::file() const
{
    return database_.file();
}

SqliteStatement& DatabaseConnection::cached(std::string_view key, std::string_view sql)
{
    const auto existing = statements_.find(key);
    if (existing != statements_.end()) {
        existing->second.reset();
        return existing->second;
    }
    return statements_.emplace(std::string(key), database_.prepare(sql)).first->second;
}

std::mutex& DatabaseConnection::mutex()
{
    return mutex_;
}

void DatabaseConnection::clear_cache()
{
    statements_.clear();
}

ReaderLease::ReaderLease(DatabaseConnection& connection, std::unique_lock<std::mutex> lock)
    : connection_(&connection)
    , lock_(std::move(lock))
{
}

DatabaseConnection& ReaderLease::connection() const
{
    return *connection_;
}

MaintenanceLease::MaintenanceLease(
    std::unique_lock<std::mutex> writer_lock,
    std::vector<std::unique_lock<std::mutex>> reader_locks)
    : writer_lock_(std::move(writer_lock))
    , reader_locks_(std::move(reader_locks))
{
}

EvaiDatabase::EvaiDatabase(const std::filesystem::path& file)
    : writer_(file)
{
    const std::size_t reader_count = resolve_reader_count();
    readers_.reserve(reader_count);
    for (std::size_t index = 0; index < reader_count; index += 1) {
        readers_.push_back(std::make_unique<DatabaseConnection>(file));
    }
}

ReaderLease EvaiDatabase::acquire_reader()
{
    for (const std::unique_ptr<DatabaseConnection>& reader : readers_) {
        std::unique_lock<std::mutex> lock(reader->mutex(), std::try_to_lock);
        if (lock.owns_lock()) {
            return ReaderLease(*reader, std::move(lock));
        }
    }
    std::unique_lock<std::mutex> lock(readers_.front()->mutex());
    return ReaderLease(*readers_.front(), std::move(lock));
}

DatabaseSummary EvaiDatabase::read_summary()
{
    const ReaderLease reader = acquire_reader();
    DatabaseSummary summary{0};
    for (const StoreDescriptor& descriptor : store_descriptors()) {
        SqliteStatement& statement = reader.connection().cached(
            std::format("count|{}", descriptor.table),
            std::format("SELECT count(*) FROM {}", descriptor.table));
        summary.record_count += statement.step() ? statement.column_integer(0) : 0;
        statement.reset();
    }
    return summary;
}

std::optional<std::string> EvaiDatabase::read_ollama_base_url()
{
    const ReaderLease reader = acquire_reader();
    SqliteStatement& statement = reader.connection().cached(
        "settings|ollama_base_url", "SELECT ollama_base_url FROM app_settings WHERE slot = 'current'");
    if (!statement.step()) {
        statement.reset();
        return std::nullopt;
    }
    std::string base_url = statement.column_text(0);
    statement.reset();
    if (base_url.empty()) {
        return std::nullopt;
    }
    return base_url;
}

const std::filesystem::path& EvaiDatabase::file() const
{
    return writer_.file();
}

StorageResponse EvaiDatabase::read_document(std::string_view request_body)
{
    const ReaderLease reader = acquire_reader();
    try {
        SqliteStatement& fields = reader.connection().cached("request|get", document_request_sql);
        fields.bind_text(1, request_body);
        const bool parsed = fields.step();
        const JsonField store{parsed && !fields.column_is_null(0), parsed ? fields.column_text(0) : std::string{}};
        const JsonField key{parsed && !fields.column_is_null(1), parsed ? fields.column_text(1) : std::string{}};
        const std::string key_type = parsed ? fields.column_text(2) : std::string{};
        fields.reset();
        if (!store.present) {
            return error_response(400, "invalid_request", "store is required");
        }
        const StoreDescriptor* descriptor = find_store_descriptor(store.text);
        if (descriptor == nullptr) {
            return error_response(400, "unknown_store", store.text);
        }
        if (!key.present || key_type != "array") {
            return error_response(400, "invalid_request", "key must be an array");
        }
        SqliteStatement& statement = reader.connection().cached(
            std::format("get|{}", descriptor->store), build_get_sql(*descriptor));
        statement.bind_text(1, key.text);
        if (!statement.step()) {
            statement.reset();
            return StorageResponse{200, "{\"found\":false}"};
        }
        StorageResponse response{200, std::format("{{\"found\":true,\"document\":{}}}", statement.column_text(0))};
        statement.reset();
        return response;
    }
    catch (const std::exception& error) {
        const std::string detail = describe_exception(error);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
}

namespace {

enum class QueryField : std::size_t {
    store = 0,
    index = 1,
    direction = 2,
    keys_only = 3,
    only_type = 4,
    only_value = 5,
    only_length = 6,
    lower_type = 7,
    lower_value = 8,
    lower_length = 9,
    upper_type = 10,
    upper_value = 11,
    upper_length = 12,
    lower_open = 13,
    upper_open = 14,
};

const JsonField& field_of(const QueryRequestFields& fields, QueryField selector)
{
    return fields[static_cast<std::size_t>(selector)];
}

QueryRequestFields read_query_request(DatabaseConnection& connection, std::string_view request_body)
{
    SqliteStatement& statement = connection.cached("request|query", query_request_sql);
    statement.bind_text(1, request_body);
    QueryRequestFields fields{};
    if (statement.step()) {
        for (std::size_t index = 0; index < query_request_field_count; index += 1) {
            const int column = static_cast<int>(index);
            fields[index] = JsonField{!statement.column_is_null(column), statement.column_text(column)};
        }
    }
    statement.reset();
    return fields;
}

std::optional<ParsedQuery> parse_query(DatabaseConnection& connection, std::string_view request_body, std::string& failure)
{
    const QueryRequestFields fields = read_query_request(connection, request_body);
    const JsonField& store = field_of(fields, QueryField::store);
    if (!store.present) {
        failure = "store is required";
        return std::nullopt;
    }
    const StoreDescriptor* descriptor = find_store_descriptor(store.text);
    if (descriptor == nullptr) {
        failure = std::format("unknown store {}", store.text);
        return std::nullopt;
    }
    const JsonField& index_name = field_of(fields, QueryField::index);
    const StoreIndex* index = nullptr;
    if (index_name.present) {
        index = find_store_index(*descriptor, index_name.text);
        if (index == nullptr) {
            failure = std::format("unknown index {}", index_name.text);
            return std::nullopt;
        }
    }
    const JsonField& direction = field_of(fields, QueryField::direction);
    const JsonField& keys_only = field_of(fields, QueryField::keys_only);
    const JsonField& lower_open = field_of(fields, QueryField::lower_open);
    const JsonField& upper_open = field_of(fields, QueryField::upper_open);
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
    const std::string expected_length = std::to_string(component_count);
    const auto validate_components = [&](QueryField type_selector, QueryField length_selector) {
        if (field_of(fields, type_selector).text != "array") {
            failure = "range keys must be arrays";
            return false;
        }
        const JsonField& length = field_of(fields, length_selector);
        if (!length.present || length.text != expected_length) {
            failure = std::format("range key must hold {} components", component_count);
            return false;
        }
        return true;
    };
    const JsonField& only = field_of(fields, QueryField::only_value);
    const JsonField& lower = field_of(fields, QueryField::lower_value);
    const JsonField& upper = field_of(fields, QueryField::upper_value);
    if (only.present) {
        if (!validate_components(QueryField::only_type, QueryField::only_length)) {
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
        if (!validate_components(QueryField::lower_type, QueryField::lower_length)
            || !validate_components(QueryField::upper_type, QueryField::upper_length)) {
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
    const ReaderLease reader = acquire_reader();
    try {
        std::string failure;
        const std::optional<ParsedQuery> parsed = parse_query(reader.connection(), request_body, failure);
        if (!parsed.has_value()) {
            return error_response(400, "invalid_request", failure);
        }
        SqliteStatement& statement = reader.connection().cached(
            plan_cache_key("query", parsed->plan), build_query_sql(parsed->plan));
        bind_range(statement, *parsed);
        std::string body = "{\"entries\":[";
        bool separated = false;
        while (statement.step()) {
            if (separated) {
                body += ',';
            }
            separated = true;
            body += "{\"key\":";
            body += statement.column_text(0);
            body += ",\"primary_key\":";
            body += statement.column_text(1);
            if (!parsed->plan.keys_only) {
                body += ",\"document\":";
                body += statement.column_text(2);
            }
            body += '}';
        }
        statement.reset();
        body += "]}";
        return StorageResponse{200, std::move(body)};
    }
    catch (const std::exception& error) {
        const std::string detail = describe_exception(error);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
}

StorageResponse EvaiDatabase::count_entries(std::string_view request_body)
{
    const ReaderLease reader = acquire_reader();
    try {
        std::string failure;
        const std::optional<ParsedQuery> parsed = parse_query(reader.connection(), request_body, failure);
        if (!parsed.has_value()) {
            return error_response(400, "invalid_request", failure);
        }
        SqliteStatement& statement = reader.connection().cached(
            plan_cache_key("count", parsed->plan), build_count_sql(parsed->plan));
        bind_range(statement, *parsed);
        const std::int64_t count = statement.step() ? statement.column_integer(0) : 0;
        statement.reset();
        return StorageResponse{200, std::format("{{\"count\":{}}}", count)};
    }
    catch (const std::exception& error) {
        const std::string detail = describe_exception(error);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
}

namespace {

class StatementReset {
public:
    explicit StatementReset(SqliteStatement& statement)
        : statement_(&statement)
    {
    }

    StatementReset(const StatementReset&) = delete;
    StatementReset& operator=(const StatementReset&) = delete;
    StatementReset(StatementReset&&) = delete;
    StatementReset& operator=(StatementReset&&) = delete;

    ~StatementReset()
    {
        statement_->reset();
    }

private:
    SqliteStatement* statement_;
};

void apply_write(
    DatabaseConnection& connection,
    const StoreDescriptor& descriptor,
    std::string_view operation,
    std::string_view element,
    std::string_view key_text)
{
    if (operation == "clear") {
        SqliteStatement& statement = connection.cached(std::format("{}|clear", descriptor.store), build_clear_sql(descriptor));
        statement.run();
        return;
    }
    if (operation == "delete") {
        if (key_text.empty()) {
            throw std::runtime_error("delete requires a key");
        }
        SqliteStatement& statement = connection.cached(std::format("{}|delete", descriptor.store), build_delete_sql(descriptor));
        statement.bind_text(1, key_text);
        statement.run();
        return;
    }
    if (operation != "put" && operation != "add") {
        throw std::runtime_error(std::format("unknown write operation {}", operation));
    }
    const bool insert_only = operation == "add";
    SqliteStatement& statement = connection.cached(
        std::format("{}|{}", descriptor.store, operation),
        build_put_sql(descriptor, insert_only));
    statement.bind_text(1, element);
    statement.run();
    if (!descriptor.source_message_links) {
        return;
    }
    SqliteStatement& link_delete = connection.cached("links|delete", build_link_delete_sql());
    link_delete.bind_text(1, element);
    link_delete.run();
    SqliteStatement& link_insert = connection.cached("links|insert", build_link_insert_sql());
    link_insert.bind_text(1, element);
    link_insert.run();
}

}

StorageResponse EvaiDatabase::commit_writes(std::string_view request_body)
{
    const std::lock_guard<std::mutex> lock(writer_.mutex());
    try {
        writer_.database().execute("BEGIN IMMEDIATE");
    }
    catch (const std::exception& error) {
        const std::string detail = describe_exception(error);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
    try {
        SqliteStatement& writes = writer_.cached("commit|writes", commit_writes_sql);
        const StatementReset guard(writes);
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
            apply_write(writer_, *descriptor, operation, element, key_text);
            applied += 1;
        }
        writer_.database().execute("COMMIT");
        return StorageResponse{200, std::format("{{\"written\":{}}}", applied)};
    }
    catch (const std::exception& error) {
        const std::string detail = describe_exception(error) + rollback_failure(writer_);
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
    const std::lock_guard<std::mutex> lock(writer_.mutex());
    try {
        writer_.database().execute("BEGIN IMMEDIATE");
    }
    catch (const std::exception& error) {
        const std::string detail = describe_exception(error);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
    try {
        for (const std::string_view statement_text : clear_order) {
            writer_.database().execute(statement_text);
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
            SqliteStatement& records = writer_.cached(std::format("restore|{}", store), element_sql);
            const StatementReset guard(records);
            records.bind_text(1, request_body);
            while (records.step()) {
                const std::string element = records.column_text(0);
                apply_write(writer_, *descriptor, "put", element, singleton_key_json);
                restored += 1;
            }
        }
        std::int64_t normalized = 0;
        for (const std::string_view statement_text : normalization_sql) {
            writer_.database().execute(statement_text);
            normalized += writer_.database().changes();
        }
        writer_.database().execute("COMMIT");
        return StorageResponse{200, std::format("{{\"restored\":{},\"normalized\":{}}}", restored, normalized)};
    }
    catch (const std::exception& error) {
        const std::string detail = describe_exception(error) + rollback_failure(writer_);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
}

MaintenanceLease EvaiDatabase::lock_for_maintenance()
{
    std::unique_lock<std::mutex> writer_lock(writer_.mutex());
    std::vector<std::unique_lock<std::mutex>> reader_locks;
    reader_locks.reserve(readers_.size());
    for (const std::unique_ptr<DatabaseConnection>& reader : readers_) {
        reader_locks.emplace_back(reader->mutex());
        reader->clear_cache();
    }
    writer_.clear_cache();
    return MaintenanceLease(std::move(writer_lock), std::move(reader_locks));
}

StorageResponse EvaiDatabase::reset_storage()
{
    const MaintenanceLease lease = lock_for_maintenance();
    try {
        writer_.database().execute("BEGIN IMMEDIATE");
    }
    catch (const std::exception& error) {
        const std::string detail = describe_exception(error);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
    try {
        for (const std::string_view statement_text : clear_order) {
            writer_.database().execute(statement_text);
        }
        writer_.database().execute("COMMIT");
    }
    catch (const std::exception& error) {
        const std::string detail = describe_exception(error) + rollback_failure(writer_);
        return error_response(sqlite_failure_status(detail), "storage_error", detail);
    }
    writer_.database().execute("PRAGMA wal_checkpoint(TRUNCATE)");
    writer_.database().execute("VACUUM");
    writer_.database().execute("PRAGMA wal_checkpoint(TRUNCATE)");
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
    const ReaderLease reader = acquire_reader();
    try {
        std::vector<SchemaObject> objects;
        SqliteStatement& listing = reader.connection().cached(
            "schema|listing",
            "SELECT name, type, coalesce(sql, '') FROM sqlite_schema "
            "WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' "
            "ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name");
        while (listing.step()) {
            objects.push_back(SchemaObject{listing.column_text(0), listing.column_text(1), listing.column_text(2)});
        }
        listing.reset();
        std::string tables;
        std::int64_t link_rows = 0;
        for (const SchemaObject& object : objects) {
            SqliteStatement& counter = reader.connection().cached(
                std::format("schema_count|{}", object.name),
                std::format("SELECT count(*) FROM \"{}\"", object.name));
            const std::int64_t rows = counter.step() ? counter.column_integer(0) : 0;
            counter.reset();
            if (object.name == link_table_name) {
                link_rows = rows;
            }
            SqliteStatement& details = reader.connection().cached("schema|detail", schema_object_detail_sql);
            const StatementReset guard(details);
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
        return StorageResponse{200, std::format(
            "{{\"sqlite_version\":\"{}\",\"link_row_count\":{},\"tables\":[{}]}}",
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
    const ReaderLease reader = acquire_reader();
    try {
        std::string counts;
        for (const StoreDescriptor& descriptor : store_descriptors()) {
            SqliteStatement& statement = reader.connection().cached(
                std::format("count|{}", descriptor.table),
                std::format("SELECT count(*) FROM {}", descriptor.table));
            const std::int64_t count = statement.step() ? statement.column_integer(0) : 0;
            statement.reset();
            if (!counts.empty()) {
                counts += ',';
            }
            counts += std::format("\"{}\":{}", descriptor.store, count);
        }
        std::error_code size_error;
        const std::uintmax_t file_bytes = std::filesystem::file_size(reader.connection().file(), size_error);
        const std::string path_text = http::json_escaped(reader.connection().file().string());
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
    database.execute("PRAGMA wal_checkpoint(TRUNCATE)");
}

}
