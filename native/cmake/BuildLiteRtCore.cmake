cmake_minimum_required(VERSION 3.25)
file(MAKE_DIRECTORY "${OUTPUT_ROOT}")
set(ENV{BAZELISK_HOME} "${OUTPUT_ROOT}/bazelisk")
set(ENV{HERMETIC_PYTHON_VERSION} "3.13")
if(VC_DIRECTORY)
    set(ENV{BAZEL_VC} "${VC_DIRECTORY}")
endif()
execute_process(
    COMMAND "${BAZEL}" "--output_user_root=${OUTPUT_ROOT}" --nowindows_enable_symlinks build
        --symlink_prefix= --noshow_progress ${CORE_FLAGS} //c:litert-lm
    WORKING_DIRECTORY "${SOURCE_DIR}" RESULT_VARIABLE result)
if(NOT result EQUAL 0)
    message(FATAL_ERROR "LiteRT-LM core compilation failed (${result})")
endif()
execute_process(
    COMMAND "${BAZEL}" "--output_user_root=${OUTPUT_ROOT}" --nowindows_enable_symlinks info bazel-bin
        ${CORE_FLAGS}
    WORKING_DIRECTORY "${SOURCE_DIR}" RESULT_VARIABLE result
    OUTPUT_VARIABLE binary_dir OUTPUT_STRIP_TRAILING_WHITESPACE)
if(NOT result EQUAL 0)
    message(FATAL_ERROR "Cannot locate the compiled LiteRT-LM core")
endif()
get_filename_component(output_directory "${CORE_OUTPUT}" DIRECTORY)
file(MAKE_DIRECTORY "${output_directory}")
file(COPY_FILE "${binary_dir}/c/${CORE_FILENAME}" "${CORE_OUTPUT}" ONLY_IF_DIFFERENT)
