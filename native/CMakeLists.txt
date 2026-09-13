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

set(EVERSOUL_LITERT_LM_SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../third_party/LiteRT-LM"
    CACHE PATH "Local LiteRT-LM source checkout used to build the inference core")
set(EVERSOUL_LITERT_LM_INCLUDE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/core/litert_lm")

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
    src/browser_server.cpp
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
if("cxx_std_26" IN_LIST CMAKE_CXX_COMPILE_FEATURES)
    set(EVERSOUL_CXX_STANDARD 26)
elseif("cxx_std_23" IN_LIST CMAKE_CXX_COMPILE_FEATURES)
    set(EVERSOUL_CXX_STANDARD 23)
else()
    message(FATAL_ERROR "A compiler supporting C++23 or C++26 is required")
endif()
target_compile_features(eversoul-native-host PRIVATE cxx_std_${EVERSOUL_CXX_STANDARD})
set_target_properties(eversoul-native-host PROPERTIES
    CXX_STANDARD ${EVERSOUL_CXX_STANDARD}
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

include(cmake/LiteRtCore.cmake)

option(EVERSOUL_PORTABLE_CPU "Compile against the baseline ISA for the selected CPU architecture" ON)
if(EVERSOUL_PORTABLE_CPU AND CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    if(EVERSOUL_ARCH STREQUAL "x86_64")
        target_compile_options(eversoul-native-host PRIVATE -march=x86-64 -mtune=generic)
    elseif(EVERSOUL_ARCH STREQUAL "arm64")
        target_compile_options(eversoul-native-host PRIVATE -march=armv8-a)
    endif()
endif()
if(WIN32)
    target_compile_definitions(eversoul-native-host PRIVATE NOMINMAX)
    target_link_libraries(eversoul-native-host PRIVATE kernel32 ws2_32)
endif()
if(MINGW)
    target_link_options(eversoul-native-host PRIVATE -static)
endif()

install(TARGETS eversoul-native-host RUNTIME DESTINATION "${EVERSOUL_PLATFORM}-${EVERSOUL_ARCH}")
# Package an existing web build only; native compilation never runs or edits
# the TypeScript/Android build pipelines.
set(EVERSOUL_WEB_DIST "${CMAKE_CURRENT_SOURCE_DIR}/../dist" CACHE PATH "Existing web distribution to serve")
if(EXISTS "${EVERSOUL_WEB_DIST}/index.html")
    add_custom_command(TARGET eversoul-native-host POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory "${EVERSOUL_WEB_DIST}" "$<TARGET_FILE_DIR:eversoul-native-host>/web"
        VERBATIM)
    install(DIRECTORY "${EVERSOUL_WEB_DIST}/" DESTINATION "${EVERSOUL_PLATFORM}-${EVERSOUL_ARCH}/web")
endif()
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
