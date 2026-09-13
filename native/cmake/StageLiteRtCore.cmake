cmake_minimum_required(VERSION 3.25)

function(eversoul_replace_staged_text content_variable search replacement)
    string(FIND "${${content_variable}}" "${search}" position)
    if(position LESS 0)
        message(FATAL_ERROR "Upstream Bazel contract changed: ${search}")
    endif()
    string(REPLACE "${search}" "${replacement}" updated "${${content_variable}}")
    set(${content_variable} "${updated}" PARENT_SCOPE)
endfunction()

function(eversoul_read_staged_build relative_path content_variable)
    file(READ "${SOURCE_DIR}/${relative_path}" content)
    string(REPLACE "\r\n" "\n" content "${content}")
    set(${content_variable} "${content}" PARENT_SCOPE)
endfunction()

function(eversoul_write_staged_build relative_path content)
    get_filename_component(directory "${STAGING_DIR}/${relative_path}" DIRECTORY)
    file(MAKE_DIRECTORY "${directory}")
    set(staged_path "${STAGING_DIR}/${relative_path}")
    if(EXISTS "${staged_path}")
        file(READ "${staged_path}" existing)
        if(existing STREQUAL content)
            return()
        endif()
    endif()
    file(WRITE "${staged_path}" "${content}")
endfunction()

file(GLOB root_files RELATIVE "${SOURCE_DIR}"
    "${SOURCE_DIR}/BUILD*" "${SOURCE_DIR}/*.bzl" "${SOURCE_DIR}/PATCH*"
    "${SOURCE_DIR}/WORKSPACE" "${SOURCE_DIR}/.bazel*" "${SOURCE_DIR}/LICENSE"
    "${SOURCE_DIR}/requirements.txt")
set(core_files ${root_files})
foreach(directory c runtime schema support build_config)
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

eversoul_read_staged_build("WORKSPACE" workspace)
string(FIND "${workspace}" "rust_register_toolchains(\n" rust_repositories_start)
string(FIND "${workspace}" "cxxbridge_cmd_deps()\n" rust_repositories_end)
if(rust_repositories_start LESS 0 OR rust_repositories_end LESS rust_repositories_start)
    message(FATAL_ERROR "Upstream Bazel contract changed: Rust toolchain and crate repositories")
endif()
math(EXPR rust_repositories_length "${rust_repositories_end} + 21 - ${rust_repositories_start}")
string(SUBSTRING "${workspace}" ${rust_repositories_start} ${rust_repositories_length} rust_repositories_block)
eversoul_replace_staged_text(workspace "${rust_repositories_block}" "")
string(FIND "${workspace}" "http_archive(\n    name = \"tokenizers_cpp\"," tokenizers_start)
if(tokenizers_start LESS 0)
    message(FATAL_ERROR "Upstream Bazel contract changed: tokenizers_cpp repository")
endif()
string(SUBSTRING "${workspace}" ${tokenizers_start} -1 tokenizers_tail)
string(FIND "${tokenizers_tail}" "\n)\n" tokenizers_end)
if(tokenizers_end LESS 0)
    message(FATAL_ERROR "Upstream Bazel contract changed: tokenizers_cpp repository end")
endif()
math(EXPR tokenizers_length "${tokenizers_end} + 3")
string(SUBSTRING "${tokenizers_tail}" 0 ${tokenizers_length} tokenizers_block)
eversoul_replace_staged_text(workspace "${tokenizers_block}" "")
eversoul_write_staged_build("WORKSPACE" "${workspace}")

eversoul_write_staged_build("eversoul_rust/BUILD" [=[
package(default_visibility = ["//visibility:public"])

cc_import(
    name = "eversoul_litert_rust",
    interface_library = "eversoul_litert_rust.dll.lib",
    shared_library = "eversoul_litert_rust.dll",
)

cc_library(
    name = "cxx_cc",
    srcs = ["cxx/src/cxx.cc"],
    hdrs = ["cxx/include/cxx.h"],
    include_prefix = "rust",
    strip_include_prefix = "cxx/include",
    linkstatic = True,
)

cc_library(
    name = "llguidance_cc",
    hdrs = ["llguidance/llguidance.h"],
    includes = ["llguidance"],
    deps = [":eversoul_litert_rust"],
)

cc_library(
    name = "huggingface_tokenizer",
    hdrs = ["tokenizers/include/tokenizers_c.h"],
    includes = ["tokenizers"],
    deps = [":eversoul_litert_rust"],
)
]=])

eversoul_write_staged_build("runtime/components/rust/BUILD" [=[
package(default_visibility = ["//runtime/components:__subpackages__"])

cc_library(
    name = "minijinja_template_cpp",
    srcs = ["minijinja_template.rs.cc"],
    hdrs = ["minijinja_template.rs.h"],
    deps = [
        "//eversoul_rust:cxx_cc",
        "//eversoul_rust:eversoul_litert_rust",
    ],
)
]=])

eversoul_write_staged_build("runtime/components/tool_use/rust/BUILD" [=[
package(default_visibility = ["//runtime/components/tool_use:__subpackages__"])

cc_library(
    name = "parsers_cpp",
    srcs = ["parsers.rs.cc"],
    hdrs = ["parsers.rs.h"],
    deps = [
        "//eversoul_rust:cxx_cc",
        "//eversoul_rust:eversoul_litert_rust",
    ],
)
]=])

eversoul_read_staged_build("runtime/components/constrained_decoding/BUILD" constrained_decoding_build)
string(REPLACE "\"@crate_index__llguidance-1.3.0//:llguidance_cc\"" "\"//eversoul_rust:llguidance_cc\""
    constrained_decoding_build "${constrained_decoding_build}")
eversoul_replace_staged_text(constrained_decoding_build
    "            \"//rust:alloc_defs\",\n            \"//rust:global_allocator\",\n" "")
eversoul_write_staged_build("runtime/components/constrained_decoding/BUILD" "${constrained_decoding_build}")

eversoul_read_staged_build("support/tokenizer/BUILD" tokenizer_build)
eversoul_replace_staged_text(tokenizer_build
    "\"@tokenizers_cpp//:huggingface_tokenizer\"" "\"//eversoul_rust:huggingface_tokenizer\"")
eversoul_replace_staged_text(tokenizer_build
    "            \"//support/util:alloc_defs\",\n            \"//support/util:global_allocator\",\n" "")
eversoul_write_staged_build("support/tokenizer/BUILD" "${tokenizer_build}")

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
