find_program(EVERSOUL_CARGO NAMES cargo REQUIRED)
find_program(EVERSOUL_GIT NAMES git)
set(rust_patch_hints "")
if(EVERSOUL_GIT)
    get_filename_component(rust_git_directory "${EVERSOUL_GIT}" DIRECTORY)
    list(APPEND rust_patch_hints "${rust_git_directory}/../usr/bin" "${rust_git_directory}/../../usr/bin")
endif()
find_program(EVERSOUL_PATCH NAMES patch HINTS ${rust_patch_hints} REQUIRED)

set(rust_litert_source_dir "${EVERSOUL_LITERT_LM_ROOT}")
set(rust_root "${CMAKE_CURRENT_BINARY_DIR}/litert-rust")
set(rust_download_dir "${rust_root}/downloads")
set(rust_source_root "${rust_root}/sources")
set(rust_patch_dir "${rust_root}/patches")
set(rust_crate_dir "${rust_root}/crate")
set(rust_target_dir "${rust_root}/target")
set(EVERSOUL_RUST_GENERATED_DIR "${rust_root}/generated")
set(EVERSOUL_RUST_INCLUDE_DIR "${rust_root}/include")
file(MAKE_DIRECTORY "${rust_download_dir}" "${rust_source_root}" "${rust_patch_dir}" "${rust_crate_dir}/src"
    "${EVERSOUL_RUST_GENERATED_DIR}" "${EVERSOUL_RUST_INCLUDE_DIR}/rust")
if(WIN32)
    set(EVERSOUL_RUST_LIBRARY "${rust_target_dir}/release/eversoul_litert_rust.dll")
    set(EVERSOUL_RUST_IMPORT_LIBRARY "${rust_target_dir}/release/eversoul_litert_rust.dll.lib")
else()
    set(EVERSOUL_RUST_LIBRARY "${rust_target_dir}/release/libeversoul_litert_rust.so")
    set(EVERSOUL_RUST_IMPORT_LIBRARY "${EVERSOUL_RUST_LIBRARY}")
endif()
set(EVERSOUL_RUST_BRIDGE_SOURCES
    "${EVERSOUL_RUST_GENERATED_DIR}/runtime/components/rust/minijinja_template.rs.cc"
    "${EVERSOUL_RUST_GENERATED_DIR}/runtime/components/tool_use/rust/parsers.rs.cc")
set(EVERSOUL_RUST_BRIDGE_HEADERS
    "${EVERSOUL_RUST_GENERATED_DIR}/runtime/components/rust/minijinja_template.rs.h"
    "${EVERSOUL_RUST_GENERATED_DIR}/runtime/components/tool_use/rust/parsers.rs.h")

function(eversoul_rust_download url sha256 archive)
    file(DOWNLOAD "${url}" "${archive}" EXPECTED_HASH SHA256=${sha256} TLS_VERIFY ON STATUS status)
    list(GET status 0 status_code)
    if(NOT status_code EQUAL 0)
        list(GET status 1 status_message)
        message(FATAL_ERROR "Download failed: ${url} (${status_message})")
    endif()
endfunction()

function(eversoul_rust_extract archive signature destination)
    set(stamp "${destination}.stamp")
    if(EXISTS "${stamp}" AND EXISTS "${destination}")
        file(READ "${stamp}" recorded_signature)
        if(recorded_signature STREQUAL signature)
            set(eversoul_rust_extracted FALSE PARENT_SCOPE)
            return()
        endif()
    endif()
    file(REMOVE_RECURSE "${destination}" "${stamp}")
    file(ARCHIVE_EXTRACT INPUT "${archive}" DESTINATION "${rust_source_root}")
    if(NOT EXISTS "${destination}")
        message(FATAL_ERROR "Archive layout changed: ${archive}")
    endif()
    set(eversoul_rust_extracted TRUE PARENT_SCOPE)
endfunction()

function(eversoul_rust_source name version sha256 url output_variable)
    set(archive "${rust_download_dir}/${name}-${version}.tar.gz")
    eversoul_rust_download("${url}" "${sha256}" "${archive}")
    set(destination "${rust_source_root}/${name}-${version}")
    set(patched_files "")
    set(signature "${sha256}")
    foreach(patch IN LISTS ARGN)
        file(READ "${rust_litert_source_dir}/${patch}" patch_text)
        if(patch_text MATCHES "@[A-Za-z_][A-Za-z0-9_]*@")
            message(FATAL_ERROR "Patch contains configure placeholders: ${patch}")
        endif()
        set(patched_file "${rust_patch_dir}/${name}-${patch}")
        file(CONFIGURE OUTPUT "${patched_file}" CONTENT "${patch_text}" @ONLY NEWLINE_STYLE UNIX)
        file(SHA256 "${patched_file}" patch_hash)
        string(APPEND signature ";${patch}=${patch_hash}")
        list(APPEND patched_files "${patched_file}")
    endforeach()
    eversoul_rust_extract("${archive}" "${signature}" "${destination}")
    if(eversoul_rust_extracted)
        foreach(patched_file IN LISTS patched_files)
            execute_process(
                COMMAND "${EVERSOUL_PATCH}" -p0 --forward --batch --binary --no-backup-if-mismatch
                    -i "${patched_file}"
                WORKING_DIRECTORY "${destination}"
                RESULT_VARIABLE patch_result)
            if(NOT patch_result EQUAL 0)
                message(FATAL_ERROR "Patch does not apply to ${name}-${version}: ${patched_file}")
            endif()
        endforeach()
        file(WRITE "${destination}.stamp" "${signature}")
    endif()
    set(${output_variable} "${destination}" PARENT_SCOPE)
endfunction()

function(eversoul_rust_crate name version sha256 output_variable)
    eversoul_rust_source("${name}" "${version}" "${sha256}"
        "https://static.crates.io/crates/${name}/${name}-${version}.crate"
        source_dir ${ARGN})
    set(${output_variable} "${source_dir}" PARENT_SCOPE)
endfunction()

eversoul_rust_crate(llguidance 1.3.0 614b6ece5bc57641b9b727f8a79d338a46584efb943017d0a7454442c0b947fb
    EVERSOUL_RUST_LLGUIDANCE_DIR
    PATCH.llguidance_regexvec PATCH.llguidance_numeric PATCH.llguidance_grammar
    PATCH.llguidance_parser PATCH.llguidance_perf)
eversoul_rust_crate(toktrie 1.5.0 de81c795b1f2e5b7e531fbb587e541e124b47f434af2c427a4ae73ea0d4eca6c
    EVERSOUL_RUST_TOKTRIE_DIR PATCH.toktrie)
eversoul_rust_crate(cxx 1.0.149 478c837c611bc2a9fdeec08f85a5b198bb4e0bbdb3069f02443d2291383a7b42
    EVERSOUL_RUST_CXX_DIR)
eversoul_rust_crate(cxxbridge-cmd 1.0.149 a5fff7916bbde05c2db99469f09dcfaf203bf25b096ccbf4e761a04792412e10
    EVERSOUL_RUST_CXXBRIDGE_DIR)
eversoul_rust_source(tokenizers-cpp 0.1.1 3e0b9ec325a326b0a2cef5cf164ee94a74ac372c5881ae5af634036db0441823
    "https://github.com/mlc-ai/tokenizers-cpp/archive/refs/tags/v0.1.1.tar.gz"
    EVERSOUL_RUST_TOKENIZERS_CPP_DIR)

configure_file("${rust_litert_source_dir}/cxxbridge_cmd/Cargo.lock"
    "${EVERSOUL_RUST_CXXBRIDGE_DIR}/Cargo.lock" COPYONLY)

set(EVERSOUL_RUST_LITERT_LM_DIR "${rust_litert_source_dir}")
set(EVERSOUL_RUST_LIB_SOURCE "${rust_crate_dir}/src/lib.rs")
configure_file("${CMAKE_CURRENT_SOURCE_DIR}/rust/eversoul_litert_rust/Cargo.toml.in"
    "${rust_crate_dir}/Cargo.toml" @ONLY)
configure_file("${CMAKE_CURRENT_SOURCE_DIR}/rust/eversoul_litert_rust/lib.rs.in"
    "${EVERSOUL_RUST_LIB_SOURCE}" @ONLY)
configure_file("${rust_litert_source_dir}/Cargo.lock" "${rust_crate_dir}/Cargo.lock" COPYONLY)
configure_file("${EVERSOUL_RUST_CXX_DIR}/include/cxx.h" "${EVERSOUL_RUST_INCLUDE_DIR}/rust/cxx.h" COPYONLY)

add_custom_target(eversoul_litert_rust
    COMMAND "${CMAKE_COMMAND}"
        "-DCARGO=${EVERSOUL_CARGO}"
        "-DCXXBRIDGE_SOURCE_DIR=${EVERSOUL_RUST_CXXBRIDGE_DIR}"
        "-DCXXBRIDGE_TARGET_DIR=${rust_root}/cxxbridge-target"
        "-DCXXBRIDGE_EXECUTABLE=cxxbridge${CMAKE_EXECUTABLE_SUFFIX}"
        "-DCRATE_DIR=${rust_crate_dir}"
        "-DCRATE_TARGET_DIR=${rust_target_dir}"
        "-DLITERT_LM_SOURCE_DIR=${rust_litert_source_dir}"
        "-DGENERATED_DIR=${EVERSOUL_RUST_GENERATED_DIR}"
        -P "${CMAKE_CURRENT_LIST_DIR}/BuildLiteRtRust.cmake"
    BYPRODUCTS "${EVERSOUL_RUST_LIBRARY}" "${EVERSOUL_RUST_IMPORT_LIBRARY}"
        ${EVERSOUL_RUST_BRIDGE_SOURCES} ${EVERSOUL_RUST_BRIDGE_HEADERS}
    USES_TERMINAL VERBATIM)

add_library(eversoul_litert_rust_library SHARED IMPORTED GLOBAL)
set_target_properties(eversoul_litert_rust_library PROPERTIES IMPORTED_LOCATION "${EVERSOUL_RUST_LIBRARY}")
if(WIN32)
    set_target_properties(eversoul_litert_rust_library PROPERTIES IMPORTED_IMPLIB "${EVERSOUL_RUST_IMPORT_LIBRARY}")
endif()
add_dependencies(eversoul_litert_rust_library eversoul_litert_rust)
