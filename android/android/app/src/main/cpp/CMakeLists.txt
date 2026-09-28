cmake_minimum_required(VERSION 3.22.1)
project(appmodules LANGUAGES C CXX)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)
include(FetchContent)

get_filename_component(EVAI_REPOSITORY_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../../.." ABSOLUTE)
set(EVAI_SERVER_SOURCE_DIR "${EVAI_REPOSITORY_DIR}/server/src")
set(EVAI_SQLITE_SOURCE_DIR "${EVAI_REPOSITORY_DIR}/server/vendor/sqlite3")

set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON ON CACHE BOOL "" FORCE)
set(LLAMA_SUBPROCESS OFF CACHE BOOL "" FORCE)
set(LLAMA_LLGUIDANCE OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_APP OFF CACHE BOOL "" FORCE)
set(LLAMA_OPENSSL OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(GGML_LLAMAFILE OFF CACHE BOOL "" FORCE)

FetchContent_Declare(
    llama_cpp
    GIT_REPOSITORY https://github.com/ggml-org/llama.cpp.git
    GIT_TAG b11236
    GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(llama_cpp)
set_target_properties(llama-common PROPERTIES INTERFACE_SYSTEM_INCLUDE_DIRECTORIES $<TARGET_PROPERTY:llama-common,INTERFACE_INCLUDE_DIRECTORIES>)

add_library(evai_sqlite STATIC "${EVAI_SQLITE_SOURCE_DIR}/sqlite3.c")
target_include_directories(evai_sqlite PUBLIC "${EVAI_SQLITE_SOURCE_DIR}")
target_compile_definitions(evai_sqlite PRIVATE
    SQLITE_DQS=0
    SQLITE_THREADSAFE=1
    SQLITE_DEFAULT_MEMSTATUS=0
    SQLITE_DEFAULT_WAL_SYNCHRONOUS=1
    SQLITE_LIKE_DOESNT_MATCH_BLOBS
    SQLITE_MAX_EXPR_DEPTH=0
    SQLITE_OMIT_DEPRECATED
    SQLITE_OMIT_LOAD_EXTENSION
    SQLITE_OMIT_SHARED_CACHE
    SQLITE_USE_ALLOCA
    SQLITE_ENABLE_JSON1
    SQLITE_ENABLE_MATH_FUNCTIONS
)
target_compile_options(evai_sqlite PRIVATE -w)

add_library(evai_native SHARED
    jni/jni_text.cpp
    storage/storage_jni.cpp
    llama/llama_engine.cpp
    llama/llama_jni.cpp
    "${EVAI_SERVER_SOURCE_DIR}/http/http_response.cpp"
    "${EVAI_SERVER_SOURCE_DIR}/storage/evai_database.cpp"
    "${EVAI_SERVER_SOURCE_DIR}/storage/sqlite_database.cpp"
    "${EVAI_SERVER_SOURCE_DIR}/storage/store_schema.cpp"
)
set_target_properties(evai_native PROPERTIES CXX_STANDARD 23 CXX_STANDARD_REQUIRED YES CXX_EXTENSIONS NO)
target_include_directories(evai_native PRIVATE "${CMAKE_CURRENT_LIST_DIR}" "${EVAI_SERVER_SOURCE_DIR}")
target_compile_options(evai_native PRIVATE -Wall -Wextra -fexceptions -frtti)
target_link_libraries(evai_native PRIVATE evai_sqlite llama-common llama log android)
