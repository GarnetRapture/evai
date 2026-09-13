cmake_path(NORMAL_PATH EVERSOUL_LITERT_LM_SOURCE_DIR OUTPUT_VARIABLE EVERSOUL_LITERT_LM_ROOT)
string(REGEX REPLACE "/$" "" EVERSOUL_LITERT_LM_ROOT "${EVERSOUL_LITERT_LM_ROOT}")
if(NOT EXISTS "${EVERSOUL_LITERT_LM_ROOT}/c/engine.cc")
    message(FATAL_ERROR "LiteRT-LM source missing: ${EVERSOUL_LITERT_LM_ROOT}")
endif()
foreach(header engine.h conversation.h error_reporter.h)
    file(SHA256 "${EVERSOUL_LITERT_LM_ROOT}/c/${header}" upstream_hash)
    file(SHA256 "${EVERSOUL_LITERT_LM_INCLUDE_DIR}/c/${header}" host_hash)
    if(NOT upstream_hash STREQUAL host_hash)
        message(FATAL_ERROR "LiteRT-LM header/source mismatch: ${header}")
    endif()
endforeach()

if(WIN32 AND EVERSOUL_ARCH STREQUAL "x86_64")
    set(EVERSOUL_LITERT_PREBUILT_PLATFORM windows_x86_64)
    set(core_runtime_files libLiteRt.dll libLiteRtWebGpuAccelerator.dll
        libLiteRtTopKWebGpuSampler.dll libwebgpu_dawn.dll libGemmaModelConstraintProvider.dll)
elseif(CMAKE_SYSTEM_NAME STREQUAL "Linux" AND EVERSOUL_ARCH MATCHES "^(x86_64|arm64)$")
    set(EVERSOUL_LITERT_PREBUILT_PLATFORM linux_${EVERSOUL_ARCH})
    set(core_runtime_files libLiteRt.so libLiteRtWebGpuAccelerator.so
        libLiteRtTopKWebGpuSampler.so libwebgpu_dawn.so libGemmaModelConstraintProvider.so)
else()
    message(FATAL_ERROR "Supported native targets: Windows x86_64, Linux x86_64/arm64")
endif()

set(core_prebuilt_files "")
foreach(runtime_file IN LISTS core_runtime_files)
    set(runtime_path "${EVERSOUL_LITERT_LM_ROOT}/prebuilt/${EVERSOUL_LITERT_PREBUILT_PLATFORM}/${runtime_file}")
    if(NOT EXISTS "${runtime_path}")
        message(FATAL_ERROR "Required upstream runtime missing: ${runtime_path}")
    endif()
    file(SIZE "${runtime_path}" runtime_bytes)
    if(runtime_bytes LESS 1024)
        message(FATAL_ERROR "Fetch the LiteRT-LM Git LFS file: ${runtime_path}")
    endif()
    list(APPEND core_prebuilt_files "${runtime_path}")
endforeach()

include("${CMAKE_CURRENT_LIST_DIR}/LiteRtSources.cmake")
include("${CMAKE_CURRENT_LIST_DIR}/LiteRtDependencies.cmake")
include("${CMAKE_CURRENT_LIST_DIR}/LiteRtRust.cmake")

set_source_files_properties(${EVERSOUL_RUST_BRIDGE_SOURCES} ${EVERSOUL_RUST_BRIDGE_HEADERS} PROPERTIES GENERATED TRUE)
add_library(eversoul-litert-lm SHARED
    ${EVERSOUL_PC_RUNTIME_SOURCES}
    ${EVERSOUL_LITERT_LM_UPSTREAM_SOURCES}
    ${EVERSOUL_LITERT_LM_PROTO_SOURCES}
    "${EVERSOUL_LITERT_LM_SCHEMA_HEADER}"
    ${EVERSOUL_LITERT_HEADER_ONLY_SUPPORT_SOURCES}
    ${EVERSOUL_RUST_BRIDGE_SOURCES}
    "${EVERSOUL_RUST_CXX_DIR}/src/cxx.cc")
add_dependencies(eversoul-litert-lm eversoul_litert_rust)
target_compile_features(eversoul-litert-lm PRIVATE cxx_std_20)
set_target_properties(eversoul-litert-lm PROPERTIES
    OUTPUT_NAME litert-lm
    CXX_STANDARD 20
    CXX_STANDARD_REQUIRED ON
    CXX_EXTENSIONS OFF
    POSITION_INDEPENDENT_CODE ON
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN ON)
if(EVERSOUL_NATIVE_OUTPUT_ROOT)
    set_target_properties(eversoul-litert-lm PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY "${EVERSOUL_NATIVE_OUTPUT_ROOT}/${EVERSOUL_INSTALL_DESTINATION}"
        LIBRARY_OUTPUT_DIRECTORY "${EVERSOUL_NATIVE_OUTPUT_ROOT}/${EVERSOUL_INSTALL_DESTINATION}")
endif()
target_include_directories(eversoul-litert-lm PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}/core"
    "${EVERSOUL_LITERT_LM_ROOT}"
    "${EVERSOUL_LITERT_GENERATED_DIR}"
    "${EVERSOUL_RUST_GENERATED_DIR}")
target_include_directories(eversoul-litert-lm SYSTEM PRIVATE
    "${eversoul_litert_SOURCE_DIR}"
    "${EVERSOUL_RUST_INCLUDE_DIR}"
    "${EVERSOUL_RUST_LLGUIDANCE_DIR}"
    "${EVERSOUL_RUST_TOKENIZERS_CPP_DIR}")
target_compile_definitions(eversoul-litert-lm PRIVATE
    ENABLE_HUGGINGFACE_TOKENIZER
    ENABLE_SENTENCEPIECE_TOKENIZER
    LITERT_DISABLE_NPU=
    LITERT_DISABLE_OPENCL_SUPPORT=1)
if(WIN32)
    target_compile_definitions(eversoul-litert-lm PRIVATE NOMINMAX WIN32_LEAN_AND_MEAN NOGDI _USE_MATH_DEFINES
        _ENABLE_EXTENDED_ALIGNED_STORAGE)
endif()
if(MSVC)
    target_compile_options(eversoul-litert-lm PRIVATE /bigobj /utf-8 /Zc:__cplusplus /Zc:preprocessor /EHsc)
endif()
target_link_libraries(eversoul-litert-lm PRIVATE
    eversoul_litert_runtime
    eversoul_gemma_constraint_provider
    eversoul_litert_rust_library
    eversoul_sentencepiece
    eversoul_minizip
    eversoul_zlib
    re2::re2
    flatbuffers
    protobuf::libprotobuf
    nlohmann_json::nlohmann_json
    absl::absl_check
    absl::absl_log
    absl::any_invocable
    absl::base
    absl::btree
    absl::check
    absl::cleanup
    absl::core_headers
    absl::flat_hash_map
    absl::flat_hash_set
    absl::function_ref
    absl::hash
    absl::log
    absl::log_initialize
    absl::log_severity
    absl::log_sink
    absl::log_sink_registry
    absl::memory
    absl::no_destructor
    absl::nullability
    absl::random_distributions
    absl::random_random
    absl::span
    absl::status
    absl::statusor
    absl::str_format
    absl::strings
    absl::synchronization
    absl::time)
if(UNIX)
    set_target_properties(eversoul-litert-lm PROPERTIES BUILD_RPATH "$ORIGIN" INSTALL_RPATH "$ORIGIN")
    target_link_libraries(eversoul-litert-lm PRIVATE pthread dl)
endif()
add_dependencies(eversoul-native-host eversoul-litert-lm)

set(core_files "$<TARGET_FILE:eversoul-litert-lm>" "${EVERSOUL_RUST_LIBRARY}" ${core_prebuilt_files})
add_custom_command(TARGET eversoul-native-host POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different ${core_files} "$<TARGET_FILE_DIR:eversoul-native-host>"
    VERBATIM)
install(TARGETS eversoul-litert-lm
    RUNTIME DESTINATION "${EVERSOUL_INSTALL_DESTINATION}"
    LIBRARY DESTINATION "${EVERSOUL_INSTALL_DESTINATION}")
install(FILES "${EVERSOUL_RUST_LIBRARY}" ${core_prebuilt_files} DESTINATION "${EVERSOUL_INSTALL_DESTINATION}")
install(FILES "${EVERSOUL_LITERT_LM_INCLUDE_DIR}/LICENSE"
    DESTINATION "${EVERSOUL_PLATFORM}-${EVERSOUL_ARCH}/licenses/LiteRT-LM")
