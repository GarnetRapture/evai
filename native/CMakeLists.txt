cmake_minimum_required(VERSION 3.25 FATAL_ERROR)
project(EverSoulNativeExtension LANGUAGES C CXX)

include(FetchContent)
FetchContent_Declare(
    sqlite_amalgamation
    URL https://www.sqlite.org/2026/sqlite-amalgamation-3530400.zip
    URL_HASH SHA3_256=628a44cfe82c66aed1ccbbe85a562d2e33ebe64b3288981ed76285612227934e
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
FetchContent_MakeAvailable(sqlite_amalgamation)

FetchContent_Declare(
    nlohmann_json
    URL https://github.com/nlohmann/json/releases/download/v3.12.0/json.tar.xz
    URL_HASH SHA256=42f6e95cad6ec532fd372391373363b62a14af6d771056dbfc86160e6dfff7aa
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    SYSTEM)
set(JSON_Install OFF CACHE INTERNAL "")
FetchContent_MakeAvailable(nlohmann_json)

set(EVERSOUL_LITERT_LM_RELEASE v0.16.0)
FetchContent_Declare(
    litert_lm_c_api
    URL https://github.com/google-ai-edge/LiteRT-LM/releases/download/${EVERSOUL_LITERT_LM_RELEASE}/litert_lm_c_api-0.1.0.zip
    URL_HASH SHA256=f0f3ae7b5730af783d1f018f7ad9a8de20c25fedf01af4e35fc11d4382246f7d
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
FetchContent_MakeAvailable(litert_lm_c_api)

set(EVERSOUL_LITERT_LM_INCLUDE_DIR "${CMAKE_CURRENT_BINARY_DIR}/litert_lm_include")
configure_file("${litert_lm_c_api_SOURCE_DIR}/include/engine.h" "${EVERSOUL_LITERT_LM_INCLUDE_DIR}/c/engine.h" COPYONLY)
configure_file("${litert_lm_c_api_SOURCE_DIR}/include/conversation.h" "${EVERSOUL_LITERT_LM_INCLUDE_DIR}/c/conversation.h" COPYONLY)

add_library(eversoul_sqlite STATIC ${sqlite_amalgamation_SOURCE_DIR}/sqlite3.c)
target_include_directories(eversoul_sqlite PUBLIC ${sqlite_amalgamation_SOURCE_DIR})
target_compile_definitions(eversoul_sqlite PRIVATE
    SQLITE_DQS=0
    SQLITE_DEFAULT_FOREIGN_KEYS=1
    SQLITE_ENABLE_FTS5
    SQLITE_ENABLE_JSON1
    SQLITE_THREADSAFE=1)

add_executable(eversoul-native-host
    src/main.cpp
    src/context_database.cpp
    src/litert_lm_library.cpp
    src/local_request_channel.cpp
    src/model_runtime.cpp
    src/native_settings.cpp)
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
target_include_directories(eversoul-native-host PRIVATE src)
target_include_directories(eversoul-native-host SYSTEM PRIVATE ${EVERSOUL_LITERT_LM_INCLUDE_DIR})
target_link_libraries(eversoul-native-host PRIVATE eversoul_sqlite nlohmann_json::nlohmann_json)

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

set(EVERSOUL_LITERT_LM_PREBUILT_BASE_URL
    "https://media.githubusercontent.com/media/google-ai-edge/LiteRT-LM/${EVERSOUL_LITERT_LM_RELEASE}/prebuilt")
set(EVERSOUL_LITERT_LM_ACCELERATOR_DIR "${CMAKE_CURRENT_BINARY_DIR}/litert_lm_accelerators")
if(WIN32 AND EVERSOUL_ARCH STREQUAL "x86_64")
    set(EVERSOUL_LITERT_LM_PLATFORM windows_x86_64)
    set(EVERSOUL_LITERT_LM_RUNTIME "${litert_lm_c_api_SOURCE_DIR}/lib/windows_x86_64/bin/litert-lm.dll")
    set(EVERSOUL_LITERT_LM_ACCELERATORS
        "libLiteRtWebGpuAccelerator.dll|c17cdb57e420a9c0b8cbad424dd8322c4e1f0e7be1773a4b6cb03bb96d3bde4c"
        "libwebgpu_dawn.dll|e045ab52c99e48ab689a81d4988b90d64993cb602109f20f8444cc23e52a678d")
elseif(CMAKE_SYSTEM_NAME STREQUAL "Linux" AND EVERSOUL_ARCH STREQUAL "x86_64")
    set(EVERSOUL_LITERT_LM_PLATFORM linux_x86_64)
    set(EVERSOUL_LITERT_LM_RUNTIME "${litert_lm_c_api_SOURCE_DIR}/lib/linux_x86_64/liblitert-lm.so")
    set(EVERSOUL_LITERT_LM_ACCELERATORS
        "libLiteRtWebGpuAccelerator.so|488f6a64a6760b69a2930b82b71d4e77f731b0b2f1c33435888a6f61e375f5bd"
        "libwebgpu_dawn.so|8cadd63e1ed84d29700ab0e7a785fc674727b128384c06afd1846258fec57945")
elseif(CMAKE_SYSTEM_NAME STREQUAL "Linux" AND EVERSOUL_ARCH STREQUAL "arm64")
    set(EVERSOUL_LITERT_LM_PLATFORM linux_arm64)
    set(EVERSOUL_LITERT_LM_RUNTIME "${litert_lm_c_api_SOURCE_DIR}/lib/linux_arm64/liblitert-lm.so")
    set(EVERSOUL_LITERT_LM_ACCELERATORS
        "libLiteRtWebGpuAccelerator.so|a8f9ee0653f38ca3be1d3d235763bacc25374fbb6de871b8d2a77df859e4010e"
        "libwebgpu_dawn.so|8962a2dbcef04ce8c210a962a2dc17bced3675ffb584c84a87fdbb3957d46d28")
else()
    message(FATAL_ERROR "LiteRT-LM ${EVERSOUL_LITERT_LM_RELEASE} C API has no prebuilt runtime for ${CMAKE_SYSTEM_NAME}-${EVERSOUL_ARCH}")
endif()

set(EVERSOUL_LITERT_LM_DEPLOYED_FILES "${EVERSOUL_LITERT_LM_RUNTIME}")
foreach(EVERSOUL_ACCELERATOR_ENTRY IN LISTS EVERSOUL_LITERT_LM_ACCELERATORS)
    string(REPLACE "|" ";" EVERSOUL_ACCELERATOR_PARTS "${EVERSOUL_ACCELERATOR_ENTRY}")
    list(GET EVERSOUL_ACCELERATOR_PARTS 0 EVERSOUL_ACCELERATOR_NAME)
    list(GET EVERSOUL_ACCELERATOR_PARTS 1 EVERSOUL_ACCELERATOR_HASH)
    set(EVERSOUL_ACCELERATOR_PATH "${EVERSOUL_LITERT_LM_ACCELERATOR_DIR}/${EVERSOUL_ACCELERATOR_NAME}")
    file(DOWNLOAD
        "${EVERSOUL_LITERT_LM_PREBUILT_BASE_URL}/${EVERSOUL_LITERT_LM_PLATFORM}/${EVERSOUL_ACCELERATOR_NAME}"
        "${EVERSOUL_ACCELERATOR_PATH}"
        EXPECTED_HASH SHA256=${EVERSOUL_ACCELERATOR_HASH}
        TLS_VERIFY ON)
    list(APPEND EVERSOUL_LITERT_LM_DEPLOYED_FILES "${EVERSOUL_ACCELERATOR_PATH}")
endforeach()

add_custom_command(TARGET eversoul-native-host POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different ${EVERSOUL_LITERT_LM_DEPLOYED_FILES} "$<TARGET_FILE_DIR:eversoul-native-host>"
    VERBATIM)
install(FILES ${EVERSOUL_LITERT_LM_DEPLOYED_FILES} DESTINATION "${EVERSOUL_PLATFORM}-${EVERSOUL_ARCH}")

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
