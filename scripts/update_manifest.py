#!/usr/bin/env python3
"""Add or replace a Jellyfin plugin release in manifest.json.

Uses only the Python standard library so it can run in GitHub Actions without
extra dependencies.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

PLUGIN_GUID = "74c7cfb4-0b86-4615-bb46-a5144230a638"
PLUGIN_NAME = "Playback Analytics"
PLUGIN_DESCRIPTION = (
    "Adds an administrator dashboard for all playable media, including "
    "never-watched items. Includes storage, viewing time, sessions, viewers, "
    "series-level episode aggregation, filtering, sorting, and CSV export."
)
PLUGIN_OVERVIEW = (
    "Library-wide playback and storage analytics powered by Jellyfin and "
    "Playback Reporting."
)
PLUGIN_CATEGORY = "General"
TARGET_ABI = "12.0.0.0"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default="manifest.json")
    parser.add_argument("--repository", required=True, help="owner/repository")
    parser.add_argument("--tag", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--asset", required=True)
    parser.add_argument("--checksum", required=True)
    parser.add_argument("--timestamp", required=True)
    parser.add_argument("--changelog", required=True)
    return parser.parse_args()


def base_plugin(owner: str) -> dict:
    return {
        "guid": PLUGIN_GUID,
        "name": PLUGIN_NAME,
        "description": PLUGIN_DESCRIPTION,
        "overview": PLUGIN_OVERVIEW,
        "owner": owner,
        "category": PLUGIN_CATEGORY,
        "versions": [],
    }


def main() -> None:
    args = parse_args()
    path = Path(args.manifest)
    owner = args.repository.split("/", 1)[0]

    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
    else:
        data = []

    if not isinstance(data, list):
        raise SystemExit("manifest.json must contain a JSON array")

    plugin = next((p for p in data if p.get("guid") == PLUGIN_GUID), None)
    if plugin is None:
        plugin = base_plugin(owner)
        data.append(plugin)

    # Keep top-level metadata deterministic and current.
    plugin.update(base_plugin(owner) | {"versions": plugin.get("versions", [])})

    version_entry = {
        "version": args.version,
        "changelog": args.changelog,
        "targetAbi": TARGET_ABI,
        "sourceUrl": (
            f"https://github.com/{args.repository}/releases/download/"
            f"{args.tag}/{args.asset}"
        ),
        "checksum": args.checksum.lower(),
        "timestamp": args.timestamp,
    }

    versions = [
        v for v in plugin.get("versions", [])
        if v.get("version") != args.version
    ]
    versions.insert(0, version_entry)
    plugin["versions"] = versions

    path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
