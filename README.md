# Playback Analytics for Jellyfin 12

Playback Analytics is an administrator dashboard plugin for Jellyfin 12 that combines Jellyfin's complete library with the official Playback Reporting plugin's history.

It is designed around a simple question: **what is taking space on my server, who watches it, and what has never been watched?**

## Features

### Items view

- Watched and never-watched playable items.
- Movies, episodes, videos, and audio.
- Media/file size.
- Total viewing hours.
- Playback session count.
- Last watched time and last viewer.
- All users who have watched an item.
- Search, watch-status, and media-type filters.
- Sortable columns.
- CSV export of the currently filtered view.

### Series view

Episodes are rolled up into one row per series with:

- total, watched, and unwatched episode counts
- completion percentage
- total storage
- total viewing hours
- total playback sessions
- latest playback time and viewer
- all viewers
- filters for never watched, partially watched, and fully watched series
- CSV export

## Requirements

- Jellyfin 12.x / .NET 10
- Playback Reporting plugin installed and collecting history
- Jellyfin administrator account to view the analytics page

The plugin targets Jellyfin ABI `12.0.0.0` and is built against Jellyfin `12.0.0` packages.

## Easiest installation: GitHub + Jellyfin Catalog

This repository is ready to act as its own Jellyfin plugin repository. **You do not need to edit your GitHub username or repository name into the source.** GitHub Actions derives them automatically.

### 1. Push this repository to GitHub

Create a public GitHub repository, then push these files to its default branch (normally `main`).

Example:

```bash
git init
git add .
git commit -m "Initial Playback Analytics release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

### 2. Publish the first release

The version in `build.yaml` is currently `1.0.0.0`.

Push a matching tag:

```bash
git tag v1.0.0.0
git push origin v1.0.0.0
```

`v1.0.0` is also accepted for version `1.0.0.0`.

The **Release** GitHub Action will automatically:

1. run the front-end checks
2. compile the plugin with .NET 10
3. create the Jellyfin plugin ZIP
4. calculate its MD5 checksum
5. create a GitHub Release and upload the ZIP
6. update `manifest.json` with the release URL, checksum, ABI, and timestamp
7. commit the updated manifest back to your default branch

No GitHub username/repository placeholders need to be replaced.

### 3. Add the repository in Jellyfin

After the release workflow finishes, use:

```text
https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPOSITORY/main/manifest.json
```

If your default branch is not `main`, substitute the actual branch name.

In Jellyfin:

```text
Dashboard
  -> Plugins
  -> Repositories
  -> Add
```

Give it a name such as `Playback Analytics` and paste the manifest URL.

Then:

```text
Dashboard
  -> Plugins
  -> Catalog
  -> Playback Analytics
  -> Install
```

Restart Jellyfin once after installation.

Future tagged releases are added to the same `manifest.json`, so upgrades can be installed from Jellyfin's normal plugin UI.

See [`docs/GITHUB_REPOSITORY.md`](docs/GITHUB_REPOSITORY.md) for the complete release workflow and troubleshooting notes.

## Local build

With .NET 10, Node.js, and `zip` available:

```bash
chmod +x scripts/*.sh
./scripts/check.sh
./scripts/build.sh
```

Output:

```text
dist/Jellyfin.PlaybackAnalytics_1.0.0.0_jf12.zip
```

For direct/manual installation into a Jellyfin host or Proxmox CT, see [`docs/INSTALL.md`](docs/INSTALL.md).

## How it works

Playback Analytics does **not** open or modify `jellyfin.db` or `playback_reporting.db`.

The dashboard uses the authenticated Jellyfin administrator session to request:

- Jellyfin `/Items` for the complete playable library
- Jellyfin `/Users` for user names
- Playback Reporting `/user_usage_stats/submit_custom_query` for aggregated playback history

The browser joins those datasets by Jellyfin item ID. Library items without a Playback Reporting row naturally appear as never watched.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for more detail.

## Important meaning of "never watched"

Playback Analytics can only know about playback history still retained by Playback Reporting. If Playback Reporting deletes old events, an item whose only playback occurred before the retained history window can appear as never watched.

## Releasing a new version

1. Update the version in `build.yaml` and the project file.
2. Commit and push the change.
3. Tag that commit with the matching version.
4. Push the tag.

For example, for `1.1.0.0`:

```bash
git tag v1.1.0.0
git push origin v1.1.0.0
```

The release workflow is safe to rerun manually from GitHub Actions for an existing tag; it replaces the release asset and refreshes that version's manifest entry.

## Project layout

```text
.
├── .github/workflows/
│   ├── build.yml
│   └── release.yml
├── manifest.json
├── build.yaml
├── Directory.Build.props
├── PlaybackAnalytics.slnx
├── README.md
├── CHANGELOG.md
├── LICENSE
├── docs/
│   ├── ARCHITECTURE.md
│   ├── GITHUB_REPOSITORY.md
│   └── INSTALL.md
├── scripts/
│   ├── build.sh
│   ├── check.sh
│   ├── install.sh
│   └── update_manifest.py
├── src/
│   └── Jellyfin.Plugin.PlaybackAnalytics/
└── tests/
```

## License

MIT source license. See [`LICENSE`](LICENSE).
