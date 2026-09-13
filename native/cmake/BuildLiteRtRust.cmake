cmake_minimum_required(VERSION 3.25)

function(eversoul_run_rust_step description)
    execute_process(COMMAND ${ARGN} RESULT_VARIABLE result)
    if(NOT result EQUAL 0)
        message(FATAL_ERROR "${description} failed (${result})")
    endif()
endfunction()

eversoul_run_rust_step("cxxbridge-cmd compilation"
    "${CARGO}" build --release --locked
        --manifest-path "${CXXBRIDGE_SOURCE_DIR}/Cargo.toml"
        --target-dir "${CXXBRIDGE_TARGET_DIR}")

eversoul_run_rust_step("LiteRT-LM Rust library compilation"
    "${CARGO}" build --release
        --manifest-path "${CRATE_DIR}/Cargo.toml"
        --target-dir "${CRATE_TARGET_DIR}")

set(cxxbridge "${CXXBRIDGE_TARGET_DIR}/release/${CXXBRIDGE_EXECUTABLE}")

foreach(bridge
        "runtime/components/rust/minijinja_template"
        "runtime/components/tool_use/rust/parsers")
    get_filename_component(bridge_directory "${GENERATED_DIR}/${bridge}" DIRECTORY)
    file(MAKE_DIRECTORY "${bridge_directory}")
    eversoul_run_rust_step("cxx bridge generation for ${bridge}.rs"
        "${cxxbridge}" "${LITERT_LM_SOURCE_DIR}/${bridge}.rs"
            -o "${GENERATED_DIR}/${bridge}.rs.h"
            -o "${GENERATED_DIR}/${bridge}.rs.cc")
endforeach()
