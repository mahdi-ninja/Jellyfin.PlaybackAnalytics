#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this installer as root inside the Jellyfin host/container." >&2
  exit 1
fi

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /path/to/Jellyfin.PlaybackAnalytics_1.0.0.0_jf12.zip" >&2
  exit 1
fi

PACKAGE="$1"
PLUGIN_ROOT="${JELLYFIN_PLUGIN_ROOT:-/var/lib/jellyfin/plugins}"
PLUGIN_DIR="$PLUGIN_ROOT/Playback Analytics"

if [ ! -f "$PACKAGE" ]; then
  echo "Package not found: $PACKAGE" >&2
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  echo "unzip is required for this installer." >&2
  exit 1
fi

mkdir -p "$PLUGIN_DIR"
rm -f "$PLUGIN_DIR/Jellyfin.Plugin.PlaybackAnalytics.dll" "$PLUGIN_DIR/meta.json"
unzip -o "$PACKAGE" -d "$PLUGIN_DIR" >/dev/null
chown -R jellyfin:jellyfin "$PLUGIN_DIR"

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files jellyfin.service >/dev/null 2>&1; then
  echo "Restarting Jellyfin to load the plugin..."
  systemctl restart jellyfin
else
  echo "Plugin installed to: $PLUGIN_DIR"
  echo "Restart Jellyfin once to load it."
fi

echo "Playback Analytics installed."
