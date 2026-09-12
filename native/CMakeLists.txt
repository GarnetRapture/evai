cmake_minimum_required(VERSION 3.25 FATAL_ERROR)
project(EverSoulNativeExtension LANGUAGES C CXX)

include(FetchContent)
FetchContent_Declare(
    sqlite_amalgamation
    URL https://www.sqlite.org/2026/sqlite-amalgamation-3530400.zip
    URL_HASH SHA3_256=628a44cfe82c66aed1ccbbe85a562d2e33ebe64b3288981ed76285612227934e
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
FetchContent_MakeAvailable(sqlite_amalgamation)

find_package(ZLIB QUIET)
if(NOT ZLIB_FOUND AND MINGW)
    get_filename_component(EVERSOUL_COMPILER_BIN_DIR "${CMAKE_CXX_COMPILER}" DIRECTORY)
    get_filename_component(EVERSOUL_COMPILER_PREFIX "${EVERSOUL_COMPILER_BIN_DIR}" DIRECTORY)
    find_path(EVERSOUL_ZLIB_INCLUDE_DIR zlib.h HINTS "${EVERSOUL_COMPILER_PREFIX}/include" NO_DEFAULT_PATH)
    find_file(EVERSOUL_ZLIB_LIBRARY NAMES libz.a HINTS "${EVERSOUL_COMPILER_PREFIX}/lib" NO_DEFAULT_PATH)
    if(EVERSOUL_ZLIB_INCLUDE_DIR AND EVERSOUL_ZLIB_LIBRARY)
        add_library(ZLIB::ZLIB UNKNOWN IMPORTED)
        set_target_properties(ZLIB::ZLIB PROPERTIES
            IMPORTED_LOCATION "${EVERSOUL_ZLIB_LIBRARY}"
            INTERFACE_INCLUDE_DIRECTORIES "${EVERSOUL_ZLIB_INCLUDE_DIR}")
        set(ZLIB_FOUND TRUE)
    endif()
endif()
if(NOT ZLIB_FOUND)
    set(ZLIB_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
    set(ZLIB_BUILD_SHARED OFF CACHE BOOL "" FORCE)
    set(SKIP_INSTALL_ALL ON CACHE BOOL "" FORCE)
    FetchContent_Declare(
        eversoul_zlib
        GIT_REPOSITORY https://github.com/madler/zlib.git
        GIT_TAG v1.3.1
        GIT_SHALLOW TRUE)
    FetchContent_MakeAvailable(eversoul_zlib)
    add_library(ZLIB::ZLIB ALIAS zlibstatic)
endif()

add_library(eversoul_sqlite STATIC ${sqlite_amalgamation_SOURCE_DIR}/sqlite3.c)
target_include_directories(eversoul_sqlite PUBLIC ${sqlite_amalgamation_SOURCE_DIR})
target_compile_definitions(eversoul_sqlite PRIVATE
    SQLITE_DQS=0
    SQLITE_DEFAULT_FOREIGN_KEYS=1
    SQLITE_ENABLE_FTS5
    SQLITE_ENABLE_JSON1
    SQLITE_THREADSAFE=1)

set(EVERSOUL_SHARED_CPP ${CMAKE_CURRENT_SOURCE_DIR}/../android/app/src/main/cpp)
add_executable(eversoul-native-host
    src/main.cpp
    src/context_database.cpp
    src/litert_runtime_loader.cpp
    src/mapped_model_file.cpp
    src/model_runtime.cpp
    src/native_code_point_classifier.cpp
    src/native_settings.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/core/failure.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/format/byte_reader.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/format/flatbuffer_table.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/format/protobuf_reader.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/format/json_value.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/unicode/code_point_category.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/litertlm/container.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/litertlm/llm_metadata.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/litertlm/zlib_inflate.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/tokenizer/byte_level.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/tokenizer/pre_tokenizer.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/tokenizer/huggingface_tokenizer.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/tokenizer/sentencepiece_model.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/tokenizer/sentencepiece_tokenizer.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/tokenizer/tokenizer_factory.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/inference/tensor.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/inference/token_sampler.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/inference/chat_prompt.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/inference/stop_token_detector.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/inference/attention_mask.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/inference/generation_session.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/inference/engine.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/inference/litert_compiled_graph.cpp)
if(WIN32)
    file(TO_CMAKE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../public/favicon.ico" EVERSOUL_ICON_PATH)
    configure_file(src/eversoul_native_host.rc.in eversoul_native_host.rc @ONLY)
    target_sources(eversoul-native-host PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/eversoul_native_host.rc")
endif()
target_compile_features(eversoul-native-host PRIVATE cxx_std_26)
set_target_properties(eversoul-native-host PROPERTIES
    CXX_STANDARD 26
    CXX_STANDARD_REQUIRED ON
    CXX_EXTENSIONS OFF)
target_include_directories(eversoul-native-host PRIVATE
    src
    ${EVERSOUL_SHARED_CPP})
target_include_directories(eversoul-native-host SYSTEM PRIVATE
    ${EVERSOUL_SHARED_CPP}/third_party)
target_link_libraries(eversoul-native-host PRIVATE eversoul_sqlite ZLIB::ZLIB)

string(TOLOWER "${CMAKE_SYSTEM_NAME}" EVERSOUL_PLATFORM)
string(TOLOWER "${CMAKE_SYSTEM_PROCESSOR}" EVERSOUL_PROCESSOR)
if(EVERSOUL_PROCESSOR MATCHES "^(amd64|x86_64)$")
    set(EVERSOUL_ARCH x86_64)
elseif(EVERSOUL_PROCESSOR MATCHES "^(arm64|aarch64)$")
    set(EVERSOUL_ARCH arm64)
elseif(EVERSOUL_PROCESSOR MATCHES "^(x86|i[3-6]86)$")
    set(EVERSOUL_ARCH x86)
elseif(EVERSOUL_PROCESSOR MATCHES "^arm")
    set(EVERSOUL_ARCH arm)
else()
    set(EVERSOUL_ARCH "${EVERSOUL_PROCESSOR}")
endif()

set(EVERSOUL_NATIVE_OUTPUT_ROOT "" CACHE PATH "Optional root for platform/CPU-specific native artifacts")
if(EVERSOUL_NATIVE_OUTPUT_ROOT)
    set_target_properties(eversoul-native-host PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY "${EVERSOUL_NATIVE_OUTPUT_ROOT}/${EVERSOUL_PLATFORM}-${EVERSOUL_ARCH}")
endif()

option(EVERSOUL_PORTABLE_CPU "Compile against the baseline ISA for the selected CPU architecture" ON)
if(EVERSOUL_PORTABLE_CPU AND CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    if(EVERSOUL_ARCH STREQUAL "x86_64")
        target_compile_options(eversoul-native-host PRIVATE -march=x86-64 -mtune=generic)
    elseif(EVERSOUL_ARCH STREQUAL "arm64")
        target_compile_options(eversoul-native-host PRIVATE -march=armv8-a)
    endif()
endif()
if(WIN32)
    target_link_libraries(eversoul-native-host PRIVATE kernel32)
endif()
if(MINGW)
    target_link_options(eversoul-native-host PRIVATE -static)
endif()

install(TARGETS eversoul-native-host RUNTIME DESTINATION "${EVERSOUL_PLATFORM}-${EVERSOUL_ARCH}")
if(MSVC)
    target_compile_options(eversoul-native-host PRIVATE /W4 /permissive- /utf-8)
else()
    target_compile_options(eversoul-native-host PRIVATE -Wall -Wextra -Wpedantic)
    if(UNIX)
        target_link_libraries(eversoul-native-host PRIVATE pthread dl)
    endif()
endif()

option(EVERSOUL_WARNINGS_AS_ERRORS "Treat native host compiler warnings as errors" OFF)
if(EVERSOUL_WARNINGS_AS_ERRORS)
    if(MSVC)
        target_compile_options(eversoul-native-host PRIVATE /WX)
    else()
        target_compile_options(eversoul-native-host PRIVATE -Werror)
    endif()
endif()

enable_testing()
add_test(NAME native_context_self_test COMMAND eversoul-native-host --self-test)
