#!/usr/bin/env sh
set -eu

browser="${1:-}"
extension_id="${2:-}"
executable_input="${3:-}"
if [ -z "$browser" ] || [ -z "$extension_id" ]; then
  echo "usage: ./native/install-host.sh chrome|chromium|edge|firefox EXTENSION_ID [EXECUTABLE_OR_DIRECTORY]" >&2
  exit 2
fi

native_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -z "$executable_input" ]; then
  executable="$native_root/build/eversoul-native-host"
elif [ -d "$executable_input" ]; then
  executable="$executable_input/eversoul-native-host"
else
  executable="$executable_input"
fi
if [ ! -x "$executable" ]; then
  echo "native host executable was not found or is not executable: $executable" >&2
  exit 1
fi
executable_dir=$(CDPATH= cd -- "$(dirname -- "$executable")" && pwd)
executable="$executable_dir/$(basename -- "$executable")"
if [ "$(basename -- "$executable")" != "eversoul-native-host" ]; then
  echo "native host executable must be named eversoul-native-host: $executable" >&2
  exit 1
fi

case "$browser" in
  chrome) manifest_dir="$HOME/.config/google-chrome/NativeMessagingHosts" ;;
  chromium) manifest_dir="$HOME/.config/chromium/NativeMessagingHosts" ;;
  edge) manifest_dir="$HOME/.config/microsoft-edge/NativeMessagingHosts" ;;
  firefox) manifest_dir="$HOME/.mozilla/native-messaging-hosts" ;;
  *) echo "unsupported browser: $browser" >&2; exit 2 ;;
esac

mkdir -p "$manifest_dir"
manifest="$manifest_dir/pro.everlib.eversoul.context.json"
if [ "$browser" = "firefox" ]; then
  printf '%s\n' \
    '{' \
    '  "name": "pro.everlib.eversoul.context",' \
    '  "description": "EverSoul SQLite context host",' \
    "  \"path\": \"$executable\"," \
    '  "type": "stdio",' \
    "  \"allowed_extensions\": [\"$extension_id\"]" \
    '}' > "$manifest"
else
  printf '%s\n' \
    '{' \
    '  "name": "pro.everlib.eversoul.context",' \
    '  "description": "EverSoul SQLite context host",' \
    "  \"path\": \"$executable\"," \
    '  "type": "stdio",' \
    "  \"allowed_origins\": [\"chrome-extension://$extension_id/\"]" \
    '}' > "$manifest"
fi
echo "Registered $browser native host: $manifest"
