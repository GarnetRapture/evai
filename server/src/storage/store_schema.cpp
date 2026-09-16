#include "storage/store_schema.hpp"

#include <algorithm>
#include <cstddef>
#include <format>
#include <span>
#include <string>
#include <string_view>
#include <vector>

namespace evai::server::storage {

namespace {

constexpr std::string_view schema_version = "1";

constexpr std::string_view schema_sql = R"sql(
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS schema_meta (
    meta_key TEXT PRIMARY KEY,
    meta_value TEXT NOT NULL
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS persona (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT NOT NULL,
    archive_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document))
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS persona_localized_prompt (
    persona_id TEXT NOT NULL REFERENCES persona (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    language TEXT NOT NULL,
    source_updated_at TEXT NOT NULL,
    localized_name TEXT NOT NULL,
    cached_at TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document)),
    PRIMARY KEY (persona_id, language, source_updated_at)
) STRICT, WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS persona_localized_prompt_by_language
    ON persona_localized_prompt (language, persona_id, source_updated_at);

CREATE TABLE IF NOT EXISTS chat_room (
    id TEXT PRIMARY KEY,
    persona_id TEXT REFERENCES persona (id) DEFERRABLE INITIALLY DEFERRED,
    title TEXT NOT NULL,
    session_started_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document))
) STRICT, WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS chat_room_by_persona_id ON chat_room (persona_id, id) WHERE persona_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_room_by_updated_at ON chat_room (updated_at, id);

CREATE TABLE IF NOT EXISTS chat_message (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES chat_room (id) DEFERRABLE INITIALLY DEFERRED,
    persona_id TEXT REFERENCES persona (id) DEFERRABLE INITIALLY DEFERRED,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    delivery TEXT CHECK (delivery IS NULL OR delivery IN ('conversation', 'proactive')),
    read_at TEXT,
    created_at TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document))
) STRICT, WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS chat_message_by_room_created ON chat_message (room_id, created_at, id);
CREATE INDEX IF NOT EXISTS chat_message_by_persona_created ON chat_message (persona_id, created_at, id) WHERE persona_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS persona_memory (
    id TEXT PRIMARY KEY,
    persona_id TEXT NOT NULL REFERENCES persona (id) DEFERRABLE INITIALLY DEFERRED,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('episodic', 'semantic', 'directive', 'habit', 'affect', 'reflection', 'affinity')),
    source_room_id TEXT REFERENCES chat_room (id) DEFERRABLE INITIALLY DEFERRED,
    memory_text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document))
) STRICT, WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS persona_memory_by_persona_type_created ON persona_memory (persona_id, memory_type, created_at, id);
CREATE INDEX IF NOT EXISTS persona_memory_by_type ON persona_memory (memory_type, id);
CREATE INDEX IF NOT EXISTS persona_memory_by_source_room ON persona_memory (source_room_id, id) WHERE source_room_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS persona_memory_source_message (
    memory_id TEXT NOT NULL REFERENCES persona_memory (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    message_id TEXT NOT NULL REFERENCES chat_message (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    PRIMARY KEY (memory_id, message_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS persona_memory_source_message_by_message ON persona_memory_source_message (message_id, memory_id);

CREATE TABLE IF NOT EXISTS style_profile (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document))
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS knowledge_chunk (
    id TEXT PRIMARY KEY,
    document_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document))
) STRICT, WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS knowledge_chunk_by_document_name ON knowledge_chunk (document_name, id);

CREATE TABLE IF NOT EXISTS sync_metadata (
    metadata_key TEXT PRIMARY KEY,
    metadata_value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document))
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS app_settings (
    slot TEXT PRIMARY KEY CHECK (slot = 'current'),
    language TEXT,
    setup_stage TEXT NOT NULL,
    active_model TEXT NOT NULL,
    ollama_base_url TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document))
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS auth_session (
    slot TEXT PRIMARY KEY CHECK (slot = 'current'),
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    created_at TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document))
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS imported_module (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    document TEXT NOT NULL CHECK (json_valid(document))
) STRICT, WITHOUT ROWID;

CREATE VIEW IF NOT EXISTS persona_conversation AS
SELECT
    message.id AS message_id,
    coalesce(message.persona_id, room.persona_id) AS persona_id,
    message.room_id AS room_id,
    room.persona_id AS room_persona_id,
    message.role AS role,
    message.content AS content,
    message.delivery AS delivery,
    message.read_at AS read_at,
    message.created_at AS created_at
FROM chat_message AS message
JOIN chat_room AS room ON room.id = message.room_id;

CREATE VIEW IF NOT EXISTS persona_conversation_counts AS
SELECT
    persona_id,
    count(*) FILTER (WHERE role = 'user') AS user_message_count,
    count(*) FILTER (WHERE role = 'assistant') AS spirit_message_count,
    max(created_at) AS latest_activity_at
FROM persona_conversation
WHERE persona_id IS NOT NULL
GROUP BY persona_id;

PRAGMA foreign_keys = ON;
)sql";

const std::vector<StoreDescriptor>& descriptors()
{
    static const std::vector<StoreDescriptor> registry{
        StoreDescriptor{
            "persona_profile", "persona", {"id"}, true,
            {{"id", "id"}, {"name", "name"}, {"name_en", "name_en"}, {"archive_key", "archive_key"}, {"created_at", "created_at"}},
            {}, false,
        },
        StoreDescriptor{
            "persona_localized_prompt", "persona_localized_prompt", {"persona_id", "language", "source_updated_at"}, true,
            {{"persona_id", "persona_id"}, {"language", "language"}, {"source_updated_at", "source_updated_at"}, {"localized_name", "localized_name"}, {"cached_at", "cached_at"}},
            {StoreIndex{"by_language", {"language"}, false}}, false,
        },
        StoreDescriptor{
            "chat_room", "chat_room", {"id"}, true,
            {{"id", "id"}, {"persona_id", "persona_id"}, {"title", "title"}, {"session_started_at", "session_started_at"}, {"created_at", "created_at"}, {"updated_at", "updated_at"}},
            {StoreIndex{"by_persona_id", {"persona_id"}, true}, StoreIndex{"by_updated_at", {"updated_at"}, false}}, false,
        },
        StoreDescriptor{
            "chat_message", "chat_message", {"id"}, true,
            {{"id", "id"}, {"room_id", "room_id"}, {"persona_id", "persona_id"}, {"role", "role"}, {"content", "content"}, {"delivery", "delivery"}, {"read_at", "read_at"}, {"created_at", "created_at"}},
            {StoreIndex{"by_room_created", {"room_id", "created_at"}, false}}, false,
        },
        StoreDescriptor{
            "persona_memory", "persona_memory", {"id"}, true,
            {{"id", "id"}, {"persona_id", "persona_id"}, {"memory_type", "memory_type"}, {"source_room_id", "source_room_id"}, {"memory_text", "memory_text"}, {"created_at", "created_at"}},
            {StoreIndex{"by_persona_type_created", {"persona_id", "memory_type", "created_at"}, false}, StoreIndex{"by_type", {"memory_type"}, false}}, true,
        },
        StoreDescriptor{
            "style_profile", "style_profile", {"id"}, true,
            {{"id", "id"}, {"name", "name"}, {"created_at", "created_at"}},
            {}, false,
        },
        StoreDescriptor{
            "knowledge_chunk", "knowledge_chunk", {"id"}, true,
            {{"id", "id"}, {"document_name", "document_name"}, {"created_at", "created_at"}},
            {}, false,
        },
        StoreDescriptor{
            "sync_metadata", "sync_metadata", {"metadata_key"}, true,
            {{"metadata_key", "key"}, {"metadata_value", "value"}, {"updated_at", "updated_at"}},
            {}, false,
        },
        StoreDescriptor{
            "general_settings", "app_settings", {"slot"}, false,
            {{"slot", ""}, {"language", "language"}, {"setup_stage", "setup_stage"}, {"active_model", "active_model"}, {"ollama_base_url", "ollama_base_url"}},
            {}, false,
        },
        StoreDescriptor{
            "auth_session", "auth_session", {"slot"}, false,
            {{"slot", ""}, {"email", "email"}, {"username", "username"}, {"created_at", "created_at"}},
            {}, false,
        },
        StoreDescriptor{
            "imported_module", "imported_module", {"id"}, true,
            {{"id", "id"}, {"name", "name"}, {"enabled", "enabled"}, {"created_at", "created_at"}},
            {}, false,
        },
    };
    return registry;
}

std::string column_value_expression(const StoreColumn& column)
{
    if (column.document_path.empty()) {
        return "json_extract(?1, '$.key[0]')";
    }
    return std::format("json_extract(?1, '$.document.{}')", column.document_path);
}

std::string key_component_expression(int parameter_index, std::size_t component)
{
    return std::format("json_extract(?{}, '$[{}]')", parameter_index, component);
}

std::string join_columns(std::span<const std::string_view> columns, std::string_view separator)
{
    std::string joined;
    for (const std::string_view column : columns) {
        if (!joined.empty()) {
            joined += separator;
        }
        joined += column;
    }
    return joined;
}

std::vector<std::string_view> order_columns(const QueryPlan& plan)
{
    std::vector<std::string_view> columns;
    if (plan.index != nullptr) {
        columns.insert(columns.end(), plan.index->columns.begin(), plan.index->columns.end());
    }
    columns.insert(columns.end(), plan.descriptor->primary_columns.begin(), plan.descriptor->primary_columns.end());
    return columns;
}

std::vector<std::string_view> range_columns(const QueryPlan& plan)
{
    return plan.index == nullptr ? plan.descriptor->primary_columns : plan.index->columns;
}

std::string row_value(std::span<const std::string_view> columns)
{
    return columns.size() == 1 ? std::string(columns.front()) : std::format("({})", join_columns(columns, ", "));
}

std::string key_row_value(int parameter_index, std::size_t component_count)
{
    std::string components;
    for (std::size_t component = 0; component < component_count; ++component) {
        if (!components.empty()) {
            components += ", ";
        }
        components += key_component_expression(parameter_index, component);
    }
    return component_count == 1 ? components : std::format("({})", components);
}

std::string where_clause(const QueryPlan& plan)
{
    const std::vector<std::string_view> columns = range_columns(plan);
    std::vector<std::string> conditions;
    if (plan.index != nullptr && plan.index->nullable_columns) {
        for (const std::string_view column : plan.index->columns) {
            conditions.push_back(std::format("{} IS NOT NULL", column));
        }
    }
    if (plan.range_kind == RangeKind::only) {
        conditions.push_back(std::format("{} = {}", row_value(columns), key_row_value(1, columns.size())));
    }
    if (plan.range_kind == RangeKind::bounded) {
        conditions.push_back(std::format("{} {} {}", row_value(columns), plan.lower_open ? ">" : ">=", key_row_value(1, columns.size())));
        conditions.push_back(std::format("{} {} {}", row_value(columns), plan.upper_open ? "<" : "<=", key_row_value(2, columns.size())));
    }
    if (conditions.empty()) {
        return {};
    }
    std::string clause = " WHERE ";
    for (std::size_t index = 0; index < conditions.size(); ++index) {
        if (index > 0) {
            clause += " AND ";
        }
        clause += conditions[index];
    }
    return clause;
}

std::string json_array_expression(std::span<const std::string_view> columns)
{
    return std::format("json_array({})", join_columns(columns, ", "));
}

}

std::span<const StoreDescriptor> store_descriptors()
{
    return descriptors();
}

const StoreDescriptor* find_store_descriptor(std::string_view store)
{
    const auto match = std::ranges::find(descriptors(), store, &StoreDescriptor::store);
    return match == descriptors().end() ? nullptr : &*match;
}

const StoreIndex* find_store_index(const StoreDescriptor& descriptor, std::string_view index)
{
    const auto match = std::ranges::find(descriptor.indexes, index, &StoreIndex::name);
    return match == descriptor.indexes.end() ? nullptr : &*match;
}

std::span<const std::string_view> restore_store_order()
{
    static const std::vector<std::string_view> order{
        "persona_profile",
        "style_profile",
        "knowledge_chunk",
        "sync_metadata",
        "general_settings",
        "auth_session",
        "imported_module",
        "chat_room",
        "chat_message",
        "persona_memory",
        "persona_localized_prompt",
    };
    return order;
}

std::string_view evai_schema_sql()
{
    return schema_sql;
}

std::string_view evai_schema_version()
{
    return schema_version;
}

std::string build_get_sql(const StoreDescriptor& descriptor)
{
    return std::format(
        "SELECT json(document) FROM {} WHERE {} = {}",
        descriptor.table,
        row_value(descriptor.primary_columns),
        key_row_value(1, descriptor.primary_columns.size()));
}

std::string build_put_sql(const StoreDescriptor& descriptor, bool insert_only)
{
    std::string column_names;
    std::string value_expressions;
    std::string assignments;
    for (const StoreColumn& column : descriptor.columns) {
        if (!column_names.empty()) {
            column_names += ", ";
            value_expressions += ", ";
        }
        column_names += column.name;
        value_expressions += column_value_expression(column);
        const bool is_primary = std::ranges::find(descriptor.primary_columns, column.name) != descriptor.primary_columns.end();
        if (!is_primary) {
            assignments += std::format("{} = excluded.{}, ", column.name, column.name);
        }
    }
    const std::string insert = std::format(
        "INSERT INTO {} ({}, document) VALUES ({}, json(json_extract(?1, '$.document')))",
        descriptor.table,
        column_names,
        value_expressions);
    if (insert_only) {
        return insert;
    }
    return std::format(
        "{} ON CONFLICT ({}) DO UPDATE SET {}document = excluded.document",
        insert,
        join_columns(descriptor.primary_columns, ", "),
        assignments);
}

std::string build_delete_sql(const StoreDescriptor& descriptor)
{
    return std::format(
        "DELETE FROM {} WHERE {} = {}",
        descriptor.table,
        row_value(descriptor.primary_columns),
        key_row_value(1, descriptor.primary_columns.size()));
}

std::string build_clear_sql(const StoreDescriptor& descriptor)
{
    return std::format("DELETE FROM {}", descriptor.table);
}

std::string build_query_sql(const QueryPlan& plan)
{
    const std::vector<std::string_view> ordering = order_columns(plan);
    const std::vector<std::string_view> key_columns = plan.index == nullptr ? plan.descriptor->primary_columns : plan.index->columns;
    std::string order_clause;
    for (const std::string_view column : ordering) {
        if (!order_clause.empty()) {
            order_clause += ", ";
        }
        order_clause += std::format("{} {}", column, plan.direction == QueryDirection::ascending ? "ASC" : "DESC");
    }
    const std::string document_column = plan.keys_only ? std::string{} : ", json(document)";
    return std::format(
        "SELECT {}, {}{} FROM {}{} ORDER BY {}",
        json_array_expression(key_columns),
        json_array_expression(plan.descriptor->primary_columns),
        document_column,
        plan.descriptor->table,
        where_clause(plan),
        order_clause);
}

std::string build_count_sql(const QueryPlan& plan)
{
    return std::format("SELECT count(*) FROM {}{}", plan.descriptor->table, where_clause(plan));
}

std::string build_link_delete_sql()
{
    return "DELETE FROM persona_memory_source_message WHERE memory_id = json_extract(?1, '$.document.id')";
}

std::string build_link_insert_sql()
{
    return "INSERT OR IGNORE INTO persona_memory_source_message (memory_id, message_id) "
           "SELECT json_extract(?1, '$.document.id'), json_each.value "
           "FROM json_each(?1, '$.document.source_message_ids') "
           "WHERE json_each.type = 'text'";
}

}
