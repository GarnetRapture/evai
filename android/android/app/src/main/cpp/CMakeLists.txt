cmake_minimum_required(VERSION 3.22)
project(evai_llama LANGUAGES C CXX)

set(LLAMA_SOURCE_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../../native/llama.cpp")
if(NOT EXISTS "${LLAMA_SOURCE_DIR}/include/llama.h")
    message(FATAL_ERROR "Original llama.cpp source is required at android/native/llama.cpp")
endif()

add_subdirectory("${LLAMA_SOURCE_DIR}" "${CMAKE_CURRENT_BINARY_DIR}/llama")
add_library(evai_llama SHARED llama_bridge.cpp)
set_target_properties(evai_llama PROPERTIES CXX_STANDARD 26 CXX_STANDARD_REQUIRED YES CXX_EXTENSIONS NO)
target_include_directories(evai_llama PRIVATE "${LLAMA_SOURCE_DIR}/include")
target_link_libraries(evai_llama PRIVATE llama)
