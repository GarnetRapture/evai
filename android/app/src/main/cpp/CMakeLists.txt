cmake_minimum_required(VERSION 3.25 FATAL_ERROR)
project(EverSoulNativeBackend LANGUAGES CXX)

set(EVERSOUL_BACKEND_SOURCES
    eversoul/core/failure.cpp
    eversoul/format/byte_reader.cpp
    eversoul/format/flatbuffer_table.cpp
    eversoul/format/protobuf_reader.cpp
    eversoul/format/json_value.cpp
    eversoul/unicode/code_point_category.cpp
    eversoul/litertlm/mapped_model_file.cpp
    eversoul/litertlm/container.cpp
    eversoul/litertlm/llm_metadata.cpp
    eversoul/litertlm/zlib_inflate.cpp
    eversoul/tokenizer/byte_level.cpp
    eversoul/tokenizer/pre_tokenizer.cpp
    eversoul/tokenizer/huggingface_tokenizer.cpp
    eversoul/tokenizer/sentencepiece_model.cpp
    eversoul/tokenizer/sentencepiece_tokenizer.cpp
    eversoul/tokenizer/tokenizer_factory.cpp
    eversoul/inference/tensor.cpp
    eversoul/inference/token_sampler.cpp
    eversoul/inference/chat_prompt.cpp
    eversoul/inference/stop_token_detector.cpp
    eversoul/inference/attention_mask.cpp
    eversoul/inference/generation_session.cpp
    eversoul/inference/engine.cpp
)

add_library(eversoul_backend STATIC ${EVERSOUL_BACKEND_SOURCES})

target_compile_features(eversoul_backend PUBLIC cxx_std_26)
set_target_properties(eversoul_backend PROPERTIES
    CXX_STANDARD 26
    CXX_STANDARD_REQUIRED ON
    CXX_EXTENSIONS OFF
    POSITION_INDEPENDENT_CODE ON)

target_include_directories(eversoul_backend PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_compile_options(eversoul_backend PRIVATE -Wall -Wextra -fno-exceptions -fno-rtti)

find_library(EVERSOUL_LOG_LIBRARY log)
find_library(EVERSOUL_ANDROID_LIBRARY android)
find_library(EVERSOUL_Z_LIBRARY z)
target_link_libraries(eversoul_backend PUBLIC ${EVERSOUL_Z_LIBRARY})

option(EVERSOUL_ENABLE_LITERT "Build the LiteRT compiled-graph backend and JNI bridge" OFF)

if(EVERSOUL_ENABLE_LITERT)
    add_library(eversoul_jni SHARED
        eversoul/inference/litert_compiled_graph.cpp
        eversoul/jni/code_point_classifier_jni.cpp
        eversoul/jni/engine_jni.cpp)
    target_compile_features(eversoul_jni PUBLIC cxx_std_26)
    set_target_properties(eversoul_jni PROPERTIES
        CXX_STANDARD 26
        CXX_STANDARD_REQUIRED ON
        CXX_EXTENSIONS OFF)
    target_include_directories(eversoul_jni PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${EVERSOUL_LITERT_SDK_DIR})
    target_link_libraries(eversoul_jni PRIVATE
        eversoul_backend
        ${EVERSOUL_LOG_LIBRARY}
        ${EVERSOUL_ANDROID_LIBRARY}
        ${EVERSOUL_LITERT_LIBRARY})
endif()
