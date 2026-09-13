# Build only the upstream inference library and its dependency closure. Never
# download a release C API paired with headers from a different source revision.
if(NOT EXISTS "${EVERSOUL_LITERT_LM_SOURCE_DIR}/c/BUILD")
    message(FATAL_ERROR "LiteRT-LM source missing: ${EVERSOUL_LITERT_LM_SOURCE_DIR}")
endif()
foreach(header engine.h conversation.h error_reporter.h)
    file(SHA256 "${EVERSOUL_LITERT_LM_SOURCE_DIR}/c/${header}" upstream_hash)
    file(SHA256 "${EVERSOUL_LITERT_LM_INCLUDE_DIR}/c/${header}" host_hash)
    if(NOT upstream_hash STREQUAL host_hash)
        message(FATAL_ERROR "LiteRT-LM header/source mismatch: ${header}")
    endif()
endforeach()

if(WIN32 AND EVERSOUL_ARCH STREQUAL "x86_64")
    set(core_platform windows_x86_64)
    set(core_filename litert-lm.dll)
    set(core_flags --cxxopt=/std:c++latest)
    set(core_accelerators libLiteRt.dll libLiteRtWebGpuAccelerator.dll
        libLiteRtTopKWebGpuSampler.dll libwebgpu_dawn.dll libGemmaModelConstraintProvider.dll)
elseif(CMAKE_SYSTEM_NAME STREQUAL "Linux" AND EVERSOUL_ARCH MATCHES "^(x86_64|arm64)$")
    set(core_platform linux_${EVERSOUL_ARCH})
    set(core_filename liblitert-lm.so)
    set(core_flags --cxxopt=-std=c++23)
    if(EVERSOUL_ARCH STREQUAL "arm64")
        list(APPEND core_flags --config=linux_arm64)
    endif()
    set(core_accelerators libLiteRt.so libLiteRtWebGpuAccelerator.so
        libLiteRtTopKWebGpuSampler.so libwebgpu_dawn.so libGemmaModelConstraintProvider.so)
else()
    message(FATAL_ERROR "Supported native targets: Windows x86_64, Linux x86_64/arm64")
endif()

find_program(EVERSOUL_BAZEL NAMES bazelisk bazel REQUIRED)
if(MSVC)
    string(REGEX REPLACE "/Tools/MSVC/.*" "" core_vc_directory "${CMAKE_CXX_COMPILER}")
endif()
set(core_source "${CMAKE_CURRENT_BINARY_DIR}/litert-source")
execute_process(COMMAND ${CMAKE_COMMAND}
    "-DSOURCE_DIR=${EVERSOUL_LITERT_LM_SOURCE_DIR}"
    "-DSTAGING_DIR=${core_source}" "-DCORE_PLATFORM=${core_platform}"
    -P "${CMAKE_CURRENT_LIST_DIR}/StageLiteRtCore.cmake"
    RESULT_VARIABLE stage_result)
if(NOT stage_result EQUAL 0)
    message(FATAL_ERROR "LiteRT-LM core staging failed")
endif()
set(EVERSOUL_BAZEL_OUTPUT_ROOT "${CMAKE_CURRENT_BINARY_DIR}/bazel" CACHE PATH "Bazel output/cache root")
set(core_output "${CMAKE_CURRENT_BINARY_DIR}/litert-core/${core_filename}")
# A build target, not a configure-time compiler invocation or runtime test.
add_custom_target(eversoul_litert_core
    COMMAND ${CMAKE_COMMAND}
        "-DBAZEL=${EVERSOUL_BAZEL}"
        "-DSOURCE_DIR=${core_source}"
        "-DOUTPUT_ROOT=${EVERSOUL_BAZEL_OUTPUT_ROOT}"
        "-DCORE_FLAGS=${core_flags}"
        "-DCORE_FILENAME=${core_filename}"
        "-DCORE_OUTPUT=${core_output}"
        "-DVC_DIRECTORY=${core_vc_directory}"
        -P "${CMAKE_CURRENT_LIST_DIR}/BuildLiteRtCore.cmake"
    BYPRODUCTS "${core_output}"
    USES_TERMINAL VERBATIM)
add_dependencies(eversoul-native-host eversoul_litert_core)

set(core_files "${core_output}")
foreach(accelerator IN LISTS core_accelerators)
    set(accelerator_path "${EVERSOUL_LITERT_LM_SOURCE_DIR}/prebuilt/${core_platform}/${accelerator}")
    if(NOT EXISTS "${accelerator_path}")
        message(FATAL_ERROR "Required upstream accelerator missing: ${accelerator_path}")
    endif()
    file(SIZE "${accelerator_path}" accelerator_bytes)
    if(accelerator_bytes LESS 1024)
        message(FATAL_ERROR "Fetch the LiteRT-LM Git LFS file: ${accelerator_path}")
    endif()
    list(APPEND core_files "${accelerator_path}")
endforeach()
add_custom_command(TARGET eversoul-native-host POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different ${core_files} "$<TARGET_FILE_DIR:eversoul-native-host>"
    VERBATIM)
install(FILES ${core_files} DESTINATION "${EVERSOUL_PLATFORM}-${EVERSOUL_ARCH}")
install(FILES "${EVERSOUL_LITERT_LM_INCLUDE_DIR}/LICENSE"
    DESTINATION "${EVERSOUL_PLATFORM}-${EVERSOUL_ARCH}/licenses/LiteRT-LM")
