#include "jni/jni_text.hpp"
#include "storage/evai_database.hpp"
#include "storage/sqlite_database.hpp"

#include <jni.h>

#include <atomic>
#include <filesystem>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <string_view>

namespace {

constexpr const char* storage_failure_class = "evai/android/storage/StorageFailure";
constexpr const char* storage_exception_class = "evai/android/storage/StorageException";
constexpr int storage_success_status = 200;

std::mutex open_mutex;
std::unique_ptr<evai::server::storage::EvaiDatabase> opened_database;
std::atomic<evai::server::storage::EvaiDatabase*> active_database{nullptr};

evai::server::storage::EvaiDatabase& require_database()
{
    evai::server::storage::EvaiDatabase* database = active_database.load(std::memory_order_acquire);
    if (database == nullptr) {
        throw std::runtime_error("storage engine is not open");
    }
    return *database;
}

void throw_storage_response(JNIEnv* env, const evai::server::storage::StorageResponse& response)
{
    jclass type = env->FindClass(storage_exception_class);
    if (type == nullptr) {
        return;
    }
    jmethodID constructor = env->GetMethodID(type, "<init>", "(I[B)V");
    if (constructor == nullptr) {
        env->DeleteLocalRef(type);
        return;
    }
    jbyteArray body = evai::android::jni::make_utf8(env, response.body);
    auto* failure = static_cast<jthrowable>(env->NewObject(type, constructor, static_cast<jint>(response.status_code), body));
    env->DeleteLocalRef(body);
    env->DeleteLocalRef(type);
    if (failure != nullptr) {
        env->Throw(failure);
        env->DeleteLocalRef(failure);
    }
}

jbyteArray respond(JNIEnv* env, const evai::server::storage::StorageResponse& response)
{
    if (response.status_code != storage_success_status) {
        throw_storage_response(env, response);
        return nullptr;
    }
    return evai::android::jni::make_utf8(env, response.body);
}

template <typename Operation>
jbyteArray run_storage(JNIEnv* env, Operation&& operation)
{
    try {
        return respond(env, operation(require_database()));
    }
    catch (...) {
        evai::android::jni::throw_current(env, storage_failure_class);
        return nullptr;
    }
}

}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_evai_android_storage_StorageEngine_nativeOpen(JNIEnv* env, jobject, jbyteArray database_path)
{
    try {
        const std::filesystem::path file(evai::android::jni::read_utf8(env, database_path));
        const std::lock_guard<std::mutex> lock(open_mutex);
        if (opened_database != nullptr) {
            if (opened_database->file() != file) {
                throw std::runtime_error("storage engine is already open at " + opened_database->file().string());
            }
            return evai::android::jni::make_utf8(env, evai::server::storage::sqlite_library_version());
        }
        if (!std::filesystem::is_regular_file(file)) {
            evai::server::storage::create_evai_database(file);
        }
        opened_database = std::make_unique<evai::server::storage::EvaiDatabase>(file);
        active_database.store(opened_database.get(), std::memory_order_release);
        return evai::android::jni::make_utf8(env, evai::server::storage::sqlite_library_version());
    }
    catch (...) {
        evai::android::jni::throw_current(env, storage_failure_class);
        return nullptr;
    }
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_evai_android_storage_StorageEngine_nativeReadDocument(JNIEnv* env, jobject, jbyteArray request)
{
    return run_storage(env, [&](evai::server::storage::EvaiDatabase& database) {
        return database.read_document(evai::android::jni::read_utf8(env, request));
    });
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_evai_android_storage_StorageEngine_nativeQueryEntries(JNIEnv* env, jobject, jbyteArray request)
{
    return run_storage(env, [&](evai::server::storage::EvaiDatabase& database) {
        return database.query_entries(evai::android::jni::read_utf8(env, request));
    });
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_evai_android_storage_StorageEngine_nativeCountEntries(JNIEnv* env, jobject, jbyteArray request)
{
    return run_storage(env, [&](evai::server::storage::EvaiDatabase& database) {
        return database.count_entries(evai::android::jni::read_utf8(env, request));
    });
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_evai_android_storage_StorageEngine_nativeCommitWrites(JNIEnv* env, jobject, jbyteArray request)
{
    return run_storage(env, [&](evai::server::storage::EvaiDatabase& database) {
        return database.commit_writes(evai::android::jni::read_utf8(env, request));
    });
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_evai_android_storage_StorageEngine_nativeRestoreSnapshot(JNIEnv* env, jobject, jbyteArray request)
{
    return run_storage(env, [&](evai::server::storage::EvaiDatabase& database) {
        return database.restore_snapshot(evai::android::jni::read_utf8(env, request));
    });
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_evai_android_storage_StorageEngine_nativeResetStorage(JNIEnv* env, jobject)
{
    return run_storage(env, [](evai::server::storage::EvaiDatabase& database) {
        return database.reset_storage();
    });
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_evai_android_storage_StorageEngine_nativeReadStatus(JNIEnv* env, jobject)
{
    return run_storage(env, [](evai::server::storage::EvaiDatabase& database) {
        return database.read_status();
    });
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_evai_android_storage_StorageEngine_nativeReadSchema(JNIEnv* env, jobject)
{
    return run_storage(env, [](evai::server::storage::EvaiDatabase& database) {
        return database.read_schema();
    });
}
