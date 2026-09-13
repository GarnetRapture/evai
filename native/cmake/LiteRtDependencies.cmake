include(FetchContent)

file(READ "${EVERSOUL_LITERT_LM_ROOT}/WORKSPACE" litert_workspace)
string(REGEX MATCH "LITERT_REF = \"([0-9a-f]+)\"" litert_ref_match "${litert_workspace}")
set(EVERSOUL_LITERT_REF "${CMAKE_MATCH_1}")
string(REGEX MATCH "LITERT_SHA256 = \"([0-9a-f]+)\"" litert_sha_match "${litert_workspace}")
set(EVERSOUL_LITERT_SHA256 "${CMAKE_MATCH_1}")
if(NOT EVERSOUL_LITERT_REF OR NOT EVERSOUL_LITERT_SHA256)
    message(FATAL_ERROR "LiteRT revision is not pinned in ${EVERSOUL_LITERT_LM_ROOT}/WORKSPACE")
endif()

set(ABSL_PROPAGATE_CXX_STD ON CACHE INTERNAL "")
set(ABSL_BUILD_TESTING OFF CACHE INTERNAL "")
set(ABSL_ENABLE_INSTALL OFF CACHE INTERNAL "")
set(ABSL_USE_SYSTEM_INCLUDES ON CACHE INTERNAL "")
FetchContent_Declare(eversoul_absl
    URL https://github.com/abseil/abseil-cpp/archive/20260526.0.tar.gz
    URL_HASH SHA256=6e1aee535473414164bf83e4ebc40240dec71a4701f8a642d906e95bea1aea0c
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    SYSTEM)
FetchContent_MakeAvailable(eversoul_absl)

set(protobuf_BUILD_TESTS OFF CACHE INTERNAL "")
set(protobuf_BUILD_EXAMPLES OFF CACHE INTERNAL "")
set(protobuf_BUILD_CONFORMANCE OFF CACHE INTERNAL "")
set(protobuf_BUILD_LIBUPB OFF CACHE INTERNAL "")
set(protobuf_BUILD_SHARED_LIBS OFF CACHE INTERNAL "")
set(protobuf_INSTALL OFF CACHE INTERNAL "")
set(protobuf_MSVC_STATIC_RUNTIME OFF CACHE INTERNAL "")
set(protobuf_WITH_ZLIB OFF CACHE INTERNAL "")
set(protobuf_LOCAL_DEPENDENCIES_ONLY ON CACHE INTERNAL "")
FetchContent_Declare(eversoul_protobuf
    URL https://github.com/protocolbuffers/protobuf/releases/download/v31.1/protobuf-31.1.tar.gz
    URL_HASH SHA256=12bfd76d27b9ac3d65c00966901609e020481b9474ef75c7ff4601ac06fa0b82
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    SYSTEM)
FetchContent_MakeAvailable(eversoul_protobuf)

set(FLATBUFFERS_BUILD_TESTS OFF CACHE INTERNAL "")
set(FLATBUFFERS_INSTALL OFF CACHE INTERNAL "")
set(FLATBUFFERS_BUILD_FLATHASH OFF CACHE INTERNAL "")
set(FLATBUFFERS_BUILD_FLATC ON CACHE INTERNAL "")
FetchContent_Declare(eversoul_flatbuffers
    URL https://github.com/google/flatbuffers/archive/v25.9.23.tar.gz
    URL_HASH SHA256=9102253214dea6ae10c2ac966ea1ed2155d22202390b532d1dea64935c518ada
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    SYSTEM)
FetchContent_MakeAvailable(eversoul_flatbuffers)

set(RE2_BUILD_TESTING OFF CACHE INTERNAL "")
set(RE2_INSTALL OFF CACHE INTERNAL "")
FetchContent_Declare(eversoul_re2
    URL https://github.com/google/re2/archive/927f5d53caf8111721e734cf24724686bb745f55.tar.gz
    URL_HASH SHA256=8635bc46ac8d73974b4198229805287c8d620245f2081af155d7d96d4988a3a5
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    SYSTEM)
FetchContent_MakeAvailable(eversoul_re2)

FetchContent_Declare(eversoul_zlib
    URL https://zlib.net/fossils/zlib-1.3.1.tar.gz
    URL_HASH SHA256=9a93b2b7dfdac77ceba5a558a580e74667dd6fede4585b91eefb60f03b72df23
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    SOURCE_SUBDIR eversoul_sources_only)
FetchContent_Declare(eversoul_sentencepiece
    URL https://github.com/google/sentencepiece/archive/refs/tags/v0.2.2.tar.gz
    URL_HASH SHA256=92381f713e094a15a1ccff1ac4a5315a4c4b82a99ac1332d6ac53c9dc8e1bcf1
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    SOURCE_SUBDIR eversoul_sources_only)
FetchContent_Declare(eversoul_litert
    URL "https://github.com/google-ai-edge/LiteRT/archive/${EVERSOUL_LITERT_REF}.tar.gz"
    URL_HASH SHA256=${EVERSOUL_LITERT_SHA256}
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    SOURCE_SUBDIR eversoul_sources_only)
FetchContent_MakeAvailable(eversoul_zlib eversoul_sentencepiece eversoul_litert)

set(zlib_source "${eversoul_zlib_SOURCE_DIR}")
add_library(eversoul_zlib STATIC
    "${zlib_source}/adler32.c" "${zlib_source}/compress.c" "${zlib_source}/crc32.c"
    "${zlib_source}/deflate.c" "${zlib_source}/gzclose.c" "${zlib_source}/gzlib.c"
    "${zlib_source}/gzread.c" "${zlib_source}/gzwrite.c" "${zlib_source}/infback.c"
    "${zlib_source}/inffast.c" "${zlib_source}/inflate.c" "${zlib_source}/inftrees.c"
    "${zlib_source}/trees.c" "${zlib_source}/uncompr.c" "${zlib_source}/zutil.c")
target_include_directories(eversoul_zlib SYSTEM PUBLIC "${zlib_source}")
set_target_properties(eversoul_zlib PROPERTIES POSITION_INDEPENDENT_CODE ON)
if(MSVC)
    target_compile_definitions(eversoul_zlib PRIVATE _CRT_SECURE_NO_DEPRECATE _CRT_NONSTDC_NO_DEPRECATE)
endif()

set(minizip_generated "${CMAKE_CURRENT_BINARY_DIR}/eversoul_minizip/include/minizip")
file(MAKE_DIRECTORY "${minizip_generated}")
foreach(header ioapi.h unzip.h zip.h crypt.h iowin32.h)
    configure_file("${zlib_source}/contrib/minizip/${header}" "${minizip_generated}/${header}" COPYONLY)
endforeach()
add_library(eversoul_minizip STATIC
    "${zlib_source}/contrib/minizip/ioapi.c"
    "${zlib_source}/contrib/minizip/unzip.c")
if(WIN32)
    target_sources(eversoul_minizip PRIVATE "${zlib_source}/contrib/minizip/iowin32.c")
endif()
target_include_directories(eversoul_minizip SYSTEM PUBLIC "${CMAKE_CURRENT_BINARY_DIR}/eversoul_minizip/include")
target_include_directories(eversoul_minizip PRIVATE "${zlib_source}/contrib/minizip")
target_link_libraries(eversoul_minizip PUBLIC eversoul_zlib)
set_target_properties(eversoul_minizip PROPERTIES POSITION_INDEPENDENT_CODE ON)
if(MSVC)
    target_compile_definitions(eversoul_minizip PRIVATE _CRT_SECURE_NO_DEPRECATE _CRT_NONSTDC_NO_DEPRECATE)
endif()

set(EVERSOUL_LITERT_GENERATED_DIR "${CMAKE_CURRENT_BINARY_DIR}/litert-generated")
file(MAKE_DIRECTORY "${EVERSOUL_LITERT_GENERATED_DIR}")

function(eversoul_generate_protos output_variable proto_root output_root)
    set(generated "")
    foreach(proto IN LISTS ARGN)
        get_filename_component(proto_directory "${proto}" DIRECTORY)
        get_filename_component(proto_name "${proto}" NAME_WE)
        if(proto_directory)
            set(output_prefix "${output_root}/${proto_directory}/${proto_name}")
        else()
            set(output_prefix "${output_root}/${proto_name}")
        endif()
        add_custom_command(
            OUTPUT "${output_prefix}.pb.cc" "${output_prefix}.pb.h"
            COMMAND "${CMAKE_COMMAND}" -E make_directory "${output_root}"
            COMMAND protobuf::protoc "--proto_path=${proto_root}" "--cpp_out=${output_root}" "${proto_root}/${proto}"
            DEPENDS "${proto_root}/${proto}" protobuf::protoc
            VERBATIM)
        list(APPEND generated "${output_prefix}.pb.cc" "${output_prefix}.pb.h")
    endforeach()
    set(${output_variable} "${generated}" PARENT_SCOPE)
endfunction()

set(sentencepiece_source "${eversoul_sentencepiece_SOURCE_DIR}/src")
set(sentencepiece_generated "${CMAKE_CURRENT_BINARY_DIR}/sentencepiece-generated")
file(MAKE_DIRECTORY "${sentencepiece_generated}")
file(WRITE "${sentencepiece_generated}/config.h.in"
    "#ifndef CONFIG_H_\n#define CONFIG_H_\n#define VERSION \"0.2.2\"\n#define PACKAGE \"sentencepiece\"\n#define PACKAGE_STRING \"sentencepiece\"\n#define INSTALL_DATADIR \"\"\n#endif\n")
configure_file("${sentencepiece_generated}/config.h.in" "${sentencepiece_generated}/config.h" COPYONLY)
eversoul_generate_protos(sentencepiece_proto_sources "${sentencepiece_source}" "${sentencepiece_generated}"
    sentencepiece.proto sentencepiece_model.proto)
add_library(eversoul_sentencepiece STATIC
    ${sentencepiece_proto_sources}
    "${sentencepiece_source}/bpe_model.cc"
    "${sentencepiece_source}/char_model.cc"
    "${sentencepiece_source}/filesystem.cc"
    "${sentencepiece_source}/model_factory.cc"
    "${sentencepiece_source}/model_interface.cc"
    "${sentencepiece_source}/normalizer.cc"
    "${sentencepiece_source}/sentencepiece_processor.cc"
    "${sentencepiece_source}/unigram_model.cc"
    "${sentencepiece_source}/util.cc"
    "${sentencepiece_source}/word_model.cc")
target_include_directories(eversoul_sentencepiece SYSTEM PUBLIC "${sentencepiece_generated}" "${sentencepiece_source}")
target_compile_definitions(eversoul_sentencepiece PRIVATE ENABLE_NFKC_COMPILE SENTENCEPIECE_PG3_BUILD)
target_link_libraries(eversoul_sentencepiece PUBLIC protobuf::libprotobuf absl::base absl::check absl::cleanup
    absl::fixed_array absl::flat_hash_map absl::flat_hash_set absl::any_invocable absl::function_ref absl::log
    absl::log_globals absl::memory absl::bits absl::random_random absl::status absl::statusor absl::strings
    absl::str_format absl::synchronization absl::time absl::span absl::endian)
set_target_properties(eversoul_sentencepiece PROPERTIES POSITION_INDEPENDENT_CODE ON CXX_STANDARD 20 CXX_STANDARD_REQUIRED ON)

set(litert_source "${eversoul_litert_SOURCE_DIR}")
set(LITERT_BUILD_CONFIG_DISABLE_GPU 0)
set(LITERT_BUILD_CONFIG_DISABLE_NPU 1)
configure_file("${litert_source}/litert/build_common/build_config.h.in"
    "${EVERSOUL_LITERT_GENERATED_DIR}/litert/build_common/build_config.h")

eversoul_generate_protos(EVERSOUL_LITERT_LM_PROTO_SOURCES "${EVERSOUL_LITERT_LM_ROOT}" "${EVERSOUL_LITERT_GENERATED_DIR}"
    ${EVERSOUL_LITERT_LM_PROTO_FILES})

set(EVERSOUL_LITERT_LM_SCHEMA_HEADER "${EVERSOUL_LITERT_GENERATED_DIR}/schema/core/litertlm_header_schema_generated.h")
add_custom_command(
    OUTPUT "${EVERSOUL_LITERT_LM_SCHEMA_HEADER}"
    COMMAND "${CMAKE_COMMAND}" -E make_directory "${EVERSOUL_LITERT_GENERATED_DIR}/schema/core"
    COMMAND flatc --cpp --gen-object-api --reflect-names --gen-mutable
        -o "${EVERSOUL_LITERT_GENERATED_DIR}/schema/core"
        "${EVERSOUL_LITERT_LM_ROOT}/schema/core/litertlm_header_schema.fbs"
    DEPENDS "${EVERSOUL_LITERT_LM_ROOT}/schema/core/litertlm_header_schema.fbs" flatc
    VERBATIM)

set(EVERSOUL_LITERT_HEADER_ONLY_SUPPORT_SOURCES
    "${litert_source}/litert/c/internal/litert_logging.cc"
    "${litert_source}/litert/c/litert_common.cc"
    "${litert_source}/litert/c/litert_layout.cc"
    "${litert_source}/tflite/minimal_logging.cc"
    "${litert_source}/tflite/minimal_logging_default.cc")

set(prebuilt_directory "${EVERSOUL_LITERT_LM_ROOT}/prebuilt/${EVERSOUL_LITERT_PREBUILT_PLATFORM}")
add_library(eversoul_litert_runtime SHARED IMPORTED GLOBAL)
add_library(eversoul_gemma_constraint_provider SHARED IMPORTED GLOBAL)
if(WIN32)
    get_filename_component(msvc_tool_directory "${CMAKE_LINKER}" DIRECTORY)
    find_program(EVERSOUL_DUMPBIN NAMES dumpbin HINTS "${msvc_tool_directory}" REQUIRED)
    set(litert_import_directory "${CMAKE_CURRENT_BINARY_DIR}/litert-import")
    file(MAKE_DIRECTORY "${litert_import_directory}")
    execute_process(
        COMMAND "${EVERSOUL_DUMPBIN}" -nologo -exports "${prebuilt_directory}/libLiteRt.dll"
        OUTPUT_VARIABLE litert_exports_dump
        RESULT_VARIABLE dumpbin_result)
    if(NOT dumpbin_result EQUAL 0)
        message(FATAL_ERROR "Cannot read exports of ${prebuilt_directory}/libLiteRt.dll")
    endif()
    string(REPLACE "\n" ";" litert_export_lines "${litert_exports_dump}")
    set(litert_definition "LIBRARY libLiteRt\nEXPORTS\n")
    foreach(line IN LISTS litert_export_lines)
        if(line MATCHES "^ +[0-9]+ +[0-9A-F]+ +[0-9A-F]+ +([A-Za-z_][A-Za-z0-9_@?$]*)")
            string(APPEND litert_definition "    ${CMAKE_MATCH_1}\n")
        endif()
    endforeach()
    file(WRITE "${litert_import_directory}/libLiteRt.def.in" "${litert_definition}")
    configure_file("${litert_import_directory}/libLiteRt.def.in" "${litert_import_directory}/libLiteRt.def" COPYONLY)
    execute_process(
        COMMAND "${CMAKE_AR}" -nologo "-def:${litert_import_directory}/libLiteRt.def"
            "-out:${litert_import_directory}/libLiteRt.lib" -machine:x64
        RESULT_VARIABLE lib_result)
    if(NOT lib_result EQUAL 0)
        message(FATAL_ERROR "Cannot create the libLiteRt import library")
    endif()
    set_target_properties(eversoul_litert_runtime PROPERTIES
        IMPORTED_LOCATION "${prebuilt_directory}/libLiteRt.dll"
        IMPORTED_IMPLIB "${litert_import_directory}/libLiteRt.lib")
    set_target_properties(eversoul_gemma_constraint_provider PROPERTIES
        IMPORTED_LOCATION "${prebuilt_directory}/libGemmaModelConstraintProvider.dll"
        IMPORTED_IMPLIB "${prebuilt_directory}/libGemmaModelConstraintProvider.lib")
else()
    set_target_properties(eversoul_litert_runtime PROPERTIES IMPORTED_LOCATION "${prebuilt_directory}/libLiteRt.so")
    set_target_properties(eversoul_gemma_constraint_provider PROPERTIES
        IMPORTED_LOCATION "${prebuilt_directory}/libGemmaModelConstraintProvider.so")
endif()
