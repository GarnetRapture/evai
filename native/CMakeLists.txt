cmake_minimum_required(VERSION 3.25 FATAL_ERROR)
project(EverSoulNativeExtension LANGUAGES C CXX)

include(FetchContent)
FetchContent_Declare(
    sqlite_amalgamation
    URL https://www.sqlite.org/2026/sqlite-amalgamation-3530400.zip
    URL_HASH SHA3_256=628a44cfe82c66aed1ccbbe85a562d2e33ebe64b3288981ed76285612227934e
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
FetchContent_MakeAvailable(sqlite_amalgamation)

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
    ${EVERSOUL_SHARED_CPP}/eversoul/core/failure.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/format/json_value.cpp
    ${EVERSOUL_SHARED_CPP}/eversoul/unicode/code_point_category.cpp)
target_compile_features(eversoul-native-host PRIVATE cxx_std_26)
set_target_properties(eversoul-native-host PROPERTIES
    CXX_STANDARD 26
    CXX_STANDARD_REQUIRED ON
    CXX_EXTENSIONS OFF)
target_include_directories(eversoul-native-host PRIVATE src ${EVERSOUL_SHARED_CPP})
target_link_libraries(eversoul-native-host PRIVATE eversoul_sqlite)
if(WIN32)
    target_link_libraries(eversoul-native-host PRIVATE kernel32)
endif()
if(MSVC)
    target_compile_options(eversoul-native-host PRIVATE /W4 /permissive- /utf-8)
else()
    target_compile_options(eversoul-native-host PRIVATE -Wall -Wextra -Wpedantic)
    if(UNIX)
        target_link_libraries(eversoul-native-host PRIVATE pthread dl)
    endif()
endif()

enable_testing()
add_test(NAME native_context_self_test COMMAND eversoul-native-host --self-test)
