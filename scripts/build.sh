#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT/src/Jellyfin.Plugin.PlaybackAnalytics/Jellyfin.Plugin.PlaybackAnalytics.csproj"
DIST="$ROOT/dist"
PUBLISH="$ROOT/artifacts/publish"
PACKAGE_DIR="$ROOT/artifacts/package"
BUILD_YAML="$ROOT/build.yaml"

PLUGIN_NAME="Playback Analytics"
DLL_NAME="Jellyfin.Plugin.PlaybackAnalytics.dll"
FRAMEWORK="net10.0"

read_build_value() {
  local key="$1"
  awk -F': *' -v wanted="$key" '
    $1 == wanted {
      value=$2
      gsub(/^"|"$/, "", value)
      print value
      exit
    }
  ' "$BUILD_YAML"
}

VERSION="$(read_build_value version)"
GUID="$(read_build_value guid)"
TARGET_ABI="$(read_build_value targetAbi)"

if [ -z "$VERSION" ] || [ -z "$GUID" ] || [ -z "$TARGET_ABI" ]; then
  echo "Could not read version/guid/targetAbi from build.yaml." >&2
  exit 1
fi

if ! command -v dotnet >/dev/null 2>&1; then
  echo "The .NET 10 SDK is required to build this plugin." >&2
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required to package this plugin." >&2
  exit 1
fi

rm -rf "$PUBLISH" "$PACKAGE_DIR" "$DIST"
mkdir -p "$PUBLISH" "$PACKAGE_DIR" "$DIST"

if command -v node >/dev/null 2>&1; then
  "$ROOT/scripts/check.sh"
fi

dotnet publish "$PROJECT" \
  --configuration Release \
  --output "$PUBLISH" \
  -p:Version="$VERSION" \
  -p:AssemblyVersion="$VERSION" \
  -p:FileVersion="$VERSION"

if [ ! -f "$PUBLISH/$DLL_NAME" ]; then
  echo "Build succeeded but $DLL_NAME was not found in $PUBLISH." >&2
  exit 1
fi

cp "$PUBLISH/$DLL_NAME" "$PACKAGE_DIR/$DLL_NAME"

TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
cat > "$PACKAGE_DIR/meta.json" <<META
{
  "guid": "$GUID",
  "name": "$PLUGIN_NAME",
  "overview": "Library-wide playback and storage analytics powered by Jellyfin and Playback Reporting.",
  "description": "Includes never-watched media, storage, viewing time, sessions, viewers, series aggregation, filters, sorting and CSV export.",
  "version": "$VERSION",
  "targetAbi": "$TARGET_ABI",
  "framework": "$FRAMEWORK",
  "owner": "Community",
  "category": "General",
  "status": "Active",
  "autoUpdate": false,
  "timestamp": "$TIMESTAMP"
}
META

ZIP="$DIST/Jellyfin.PlaybackAnalytics_${VERSION}_jf12.zip"
(
  cd "$PACKAGE_DIR"
  zip -q -9 "$ZIP" "$DLL_NAME" meta.json
)

printf '\nBuilt plugin package:\n%s\n' "$ZIP"
