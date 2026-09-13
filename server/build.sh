#!/bin/sh
set -eu

SERVER_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SOURCE_DIR="$SERVER_DIR/src"
RESOURCE_DIR="$SERVER_DIR/resources"
ICON_DIR="$SERVER_DIR/../public"
OUTPUT_DIR="$SERVER_DIR/build"
CXX_COMPILER=${CXX:-g++}
RESOURCE_COMPILER=${WINDRES:-windres}
RESOURCE_OBJECT=""
PACKAGE_VERSION=$(grep -m 1 '"version"' "$SERVER_DIR/../package.json" | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/')
case "$PACKAGE_VERSION" in
    *[!0-9.]*|"")
        printf 'package.json version is not MAJOR.MINOR.PATCH: %s\n' "$PACKAGE_VERSION" >&2
        exit 1
        ;;
esac
VERSION_MAJOR=${PACKAGE_VERSION%%.*}
VERSION_REST=${PACKAGE_VERSION#*.}
VERSION_MINOR=${VERSION_REST%%.*}
VERSION_PATCH=${VERSION_REST#*.}

SOURCES="
$SOURCE_DIR/main.cpp
$SOURCE_DIR/app/server_options.cpp
$SOURCE_DIR/http/http_request.cpp
$SOURCE_DIR/http/http_response.cpp
$SOURCE_DIR/http/mime_type.cpp
$SOURCE_DIR/net/socket_runtime.cpp
$SOURCE_DIR/net/tcp_socket.cpp
$SOURCE_DIR/platform/executable_directory.cpp
$SOURCE_DIR/site/static_site.cpp
"

case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
        OUTPUT_FILE="$OUTPUT_DIR/evai-server.exe"
        PLATFORM_FLAGS="-static -lws2_32"
        ;;
    Darwin)
        OUTPUT_FILE="$OUTPUT_DIR/evai-server"
        PLATFORM_FLAGS="-pthread"
        ;;
    *)
        OUTPUT_FILE="$OUTPUT_DIR/evai-server"
        PLATFORM_FLAGS="-pthread -static-libstdc++ -static-libgcc"
        ;;
esac

mkdir -p "$OUTPUT_DIR"
case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
        RESOURCE_OBJECT="$OUTPUT_DIR/evai_server_resources.o"
        printf '#define EVAI_VERSION_MAJOR %s\n#define EVAI_VERSION_MINOR %s\n#define EVAI_VERSION_PATCH %s\n#define EVAI_VERSION_TEXT "%s"\n' \
            "$VERSION_MAJOR" "$VERSION_MINOR" "$VERSION_PATCH" "$PACKAGE_VERSION" > "$OUTPUT_DIR/evai_server_version.h"
        "$RESOURCE_COMPILER" --include-dir="$ICON_DIR" --include-dir="$OUTPUT_DIR" -i "$RESOURCE_DIR/evai_server.rc" -O coff -o "$RESOURCE_OBJECT"
        ;;
esac
"$CXX_COMPILER" -std=c++26 -O2 -Wall -Wextra -Wpedantic -I"$SOURCE_DIR" $SOURCES $RESOURCE_OBJECT -o "$OUTPUT_FILE" $PLATFORM_FLAGS
printf '%s\n' "$OUTPUT_FILE"
