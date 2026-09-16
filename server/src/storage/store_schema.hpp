#pragma once

#include <span>
#include <string>
#include <string_view>
#include <vector>

namespace evai::server::storage {

enum class QueryDirection {
    ascending,
    descending,
};

enum class RangeKind {
    all,
    only,
    bounded,
};

struct StoreColumn {
    std::string_view name;
    std::string_view document_path;
};

struct StoreIndex {
    std::string_view name;
    std::vector<std::string_view> columns;
    bool nullable_columns;
};

struct StoreDescriptor {
    std::string_view store;
    std::string_view table;
    std::vector<std::string_view> primary_columns;
    bool inline_key;
    std::vector<StoreColumn> columns;
    std::vector<StoreIndex> indexes;
    bool source_message_links;
};

struct QueryPlan {
    const StoreDescriptor* descriptor;
    const StoreIndex* index;
    RangeKind range_kind;
    bool lower_open;
    bool upper_open;
    QueryDirection direction;
    bool keys_only;
};

[[nodiscard]] std::span<const StoreDescriptor> store_descriptors();
[[nodiscard]] const StoreDescriptor* find_store_descriptor(std::string_view store);
[[nodiscard]] const StoreIndex* find_store_index(const StoreDescriptor& descriptor, std::string_view index);
[[nodiscard]] std::span<const std::string_view> restore_store_order();
[[nodiscard]] std::string_view evai_schema_sql();

[[nodiscard]] std::string build_get_sql(const StoreDescriptor& descriptor);
[[nodiscard]] std::string build_put_sql(const StoreDescriptor& descriptor, bool insert_only);
[[nodiscard]] std::string build_delete_sql(const StoreDescriptor& descriptor);
[[nodiscard]] std::string build_clear_sql(const StoreDescriptor& descriptor);
[[nodiscard]] std::string build_query_sql(const QueryPlan& plan);
[[nodiscard]] std::string build_count_sql(const QueryPlan& plan);
[[nodiscard]] std::string build_link_delete_sql();
[[nodiscard]] std::string build_link_insert_sql();

}
