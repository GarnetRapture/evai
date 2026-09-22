#!/bin/sh
set -eu

SERVER_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
XMAKE=${XMAKE:-xmake}
OUTPUT_DIR=${1:-"$SERVER_DIR/build"}

if [ -n "${EVAI_XMAKE_PLATFORM:-}" ]; then
    "$XMAKE" f -P "$SERVER_DIR" -y -m release -p "$EVAI_XMAKE_PLATFORM"
else
    "$XMAKE" f -P "$SERVER_DIR" -y -m release
fi
"$XMAKE" -P "$SERVER_DIR" -y
"$XMAKE" stage -P "$SERVER_DIR" -o "$OUTPUT_DIR"
