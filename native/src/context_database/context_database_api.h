#pragma once

#include <stddef.h>
#include <stdint.h>

#if defined(_WIN32)
#if defined(eversoul_context_database_EXPORTS)
#define EVERSOUL_CONTEXT_DATABASE_API __declspec(dllexport)
#else
#define EVERSOUL_CONTEXT_DATABASE_API __declspec(dllimport)
#endif
#else
#define EVERSOUL_CONTEXT_DATABASE_API __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef struct EverSoulContextDatabase EverSoulContextDatabase;

typedef struct EverSoulTextView {
    const char* data;
    size_t size;
} EverSoulTextView;

typedef struct EverSoulTextBuffer {
    char* data;
    size_t size;
} EverSoulTextBuffer;

typedef int32_t EverSoulContextDatabaseStatus;

enum {
    EVERSOUL_CONTEXT_DATABASE_OK = 0,
    EVERSOUL_CONTEXT_DATABASE_FAILED = 1
};

EVERSOUL_CONTEXT_DATABASE_API EverSoulContextDatabaseStatus eversoul_context_database_open(
    EverSoulTextView utf8Path,
    EverSoulContextDatabase** database,
    EverSoulTextBuffer* output);

EVERSOUL_CONTEXT_DATABASE_API void eversoul_context_database_close(EverSoulContextDatabase* database);

EVERSOUL_CONTEXT_DATABASE_API EverSoulContextDatabaseStatus eversoul_context_database_append_message(
    EverSoulContextDatabase* database,
    EverSoulTextView id,
    EverSoulTextView roomId,
    EverSoulTextView personaId,
    EverSoulTextView role,
    EverSoulTextView content,
    EverSoulTextView createdAt,
    EverSoulTextBuffer* output);

EVERSOUL_CONTEXT_DATABASE_API EverSoulContextDatabaseStatus eversoul_context_database_append_memory(
    EverSoulContextDatabase* database,
    EverSoulTextView id,
    EverSoulTextView personaId,
    EverSoulTextView roomId,
    EverSoulTextView memoryType,
    EverSoulTextView memoryText,
    EverSoulTextView createdAt,
    const EverSoulTextView* sourceMessageIds,
    size_t sourceMessageIdCount,
    EverSoulTextBuffer* output);

EVERSOUL_CONTEXT_DATABASE_API EverSoulContextDatabaseStatus eversoul_context_database_query_context(
    EverSoulContextDatabase* database,
    EverSoulTextView personaId,
    EverSoulTextView roomId,
    int32_t recentLimit,
    int32_t memoryLimit,
    EverSoulTextBuffer* output);

EVERSOUL_CONTEXT_DATABASE_API EverSoulContextDatabaseStatus eversoul_context_database_query_statistics(
    EverSoulContextDatabase* database,
    EverSoulTextBuffer* output);

EVERSOUL_CONTEXT_DATABASE_API EverSoulContextDatabaseStatus eversoul_context_database_delete_message(
    EverSoulContextDatabase* database,
    EverSoulTextView messageId,
    EverSoulTextBuffer* output);

EVERSOUL_CONTEXT_DATABASE_API EverSoulContextDatabaseStatus eversoul_context_database_delete_room(
    EverSoulContextDatabase* database,
    EverSoulTextView roomId,
    EverSoulTextBuffer* output);

EVERSOUL_CONTEXT_DATABASE_API EverSoulContextDatabaseStatus eversoul_context_database_clear_all(
    EverSoulContextDatabase* database,
    EverSoulTextBuffer* output);

EVERSOUL_CONTEXT_DATABASE_API EverSoulTextView eversoul_context_database_engine_version(void);

EVERSOUL_CONTEXT_DATABASE_API void eversoul_context_database_release_text(EverSoulTextBuffer* buffer);

#ifdef __cplusplus
}
#endif
