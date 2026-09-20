#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required for the front-end checks." >&2
  exit 1
fi

node --check "$ROOT/src/Jellyfin.Plugin.PlaybackAnalytics/Configuration/playbackAnalytics.js"
node "$ROOT/tests/playbackAnalytics.test.js"

python3 -m json.tool "$ROOT/manifest.json" >/dev/null
python3 - "$ROOT/scripts/update_manifest.py" <<'PY'
import ast
import pathlib
import sys
path = pathlib.Path(sys.argv[1])
ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
PY

bash -n "$ROOT/scripts/build.sh"
bash -n "$ROOT/scripts/install.sh"

echo "All checks passed."
