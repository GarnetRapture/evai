cmake_minimum_required(VERSION 3.25)
# The application needs engine/session/conversation, tokenizer, schema, and
# their native dependencies. Keep language bindings, apps and model/test data
# out of the build workspace and leave the user's complete checkout untouched.
file(GLOB root_files RELATIVE "${SOURCE_DIR}"
    "${SOURCE_DIR}/BUILD*" "${SOURCE_DIR}/*.bzl" "${SOURCE_DIR}/PATCH*"
    "${SOURCE_DIR}/WORKSPACE" "${SOURCE_DIR}/.bazel*" "${SOURCE_DIR}/LICENSE"
    "${SOURCE_DIR}/*Cargo*" "${SOURCE_DIR}/cargo-bazel-lock.json" "${SOURCE_DIR}/requirements.txt")
set(core_files ${root_files})
foreach(directory c runtime schema support build_config cxxbridge_cmd cmake/rust)
    file(GLOB_RECURSE files RELATIVE "${SOURCE_DIR}" "${SOURCE_DIR}/${directory}/*")
    foreach(file IN LISTS files)
        if(NOT file MATCHES "(^|/)(testdata|tests|e2e_tests)/|_test\\.|_benchmark\\.|CMakeLists\\.txt$|\\.md$")
            list(APPEND core_files "${file}")
        endif()
    endforeach()
endforeach()
file(GLOB_RECURSE prebuilt_manifests RELATIVE "${SOURCE_DIR}" "${SOURCE_DIR}/prebuilt/*/BUILD")
file(GLOB platform_files RELATIVE "${SOURCE_DIR}" "${SOURCE_DIR}/prebuilt/${CORE_PLATFORM}/*")
list(APPEND core_files ${prebuilt_manifests} ${platform_files})
foreach(file IN LISTS core_files)
    if(IS_DIRECTORY "${SOURCE_DIR}/${file}")
        continue()
    endif()
    get_filename_component(directory "${file}" DIRECTORY)
    file(MAKE_DIRECTORY "${STAGING_DIR}/${directory}")
    file(COPY_FILE "${SOURCE_DIR}/${file}" "${STAGING_DIR}/${file}" ONLY_IF_DIFFERENT)
endforeach()

# Retain upstream dependency declarations, replacing just its broad C API
# binary target with the three translation units used by the chat service.
file(READ "${SOURCE_DIR}/c/BUILD" c_build)
string(REPLACE "\r\n" "\n" c_build "${c_build}")
string(FIND "${c_build}" "cc_binary(\n    name = \"litert-lm\"," binary_start REVERSE)
if(binary_start LESS 0)
    message(FATAL_ERROR "Upstream C API build contract changed; review the core target")
endif()
string(SUBSTRING "${c_build}" 0 ${binary_start} c_build)
string(APPEND c_build [=[
cc_binary(
    name = "litert-lm",
    srcs = ["engine.cc", "conversation.cc", "error_reporter.cc"],
    copts = select({
        "@platforms//os:windows": [],
        "//conditions:default": ["-fvisibility=hidden"],
    }),
    features = ["-legacy_whole_archive"],
    linkopts = select({
        "@platforms//os:windows": [],
        "//conditions:default": [
            "-Wl,--no-undefined", "-Wl,--gc-sections", "-Wl,-Bsymbolic",
            "-Wl,-rpath,$$ORIGIN",
        ],
    }),
    linkshared = True,
    deps = ENGINE_LITE_COMMON_DEPS + CONVERSATION_DEPS + [
        ":engine_headers", ":conversation_headers", "//runtime/core:engine_impl",
    ],
)
]=])
file(WRITE "${STAGING_DIR}/c/BUILD" "${c_build}")
