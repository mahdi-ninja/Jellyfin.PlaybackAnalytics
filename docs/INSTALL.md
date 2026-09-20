# Installation

## Recommended: install from the Jellyfin UI

Once this source has been pushed to a public GitHub repository and at least one tagged release has completed successfully, add its manifest URL in Jellyfin:

```text
Dashboard -> Plugins -> Repositories -> Add
```

Repository URL:

```text
https://raw.githubusercontent.com/OWNER/REPOSITORY/main/manifest.json
```

Then install **Playback Analytics** from:

```text
Dashboard -> Plugins -> Catalog
```

Restart Jellyfin once after installation or upgrade.

See [`GITHUB_REPOSITORY.md`](GITHUB_REPOSITORY.md) for release setup.

## Manual installation

If you prefer not to use the Jellyfin Catalog, build the package locally:

```bash
./scripts/build.sh
```

The ZIP is written to `dist/`.

### Proxmox CT example

Copy the ZIP to the CT from the Proxmox host:

```bash
pct push <CT_ID> \
  dist/Jellyfin.PlaybackAnalytics_1.0.0.0_jf12.zip \
  /tmp/Jellyfin.PlaybackAnalytics_1.0.0.0_jf12.zip
```

Enter the CT:

```bash
pct enter <CT_ID>
```

If you also copied the source repository into the CT, run:

```bash
./scripts/install.sh /tmp/Jellyfin.PlaybackAnalytics_1.0.0.0_jf12.zip
```

Or install the package manually:

```bash
mkdir -p '/var/lib/jellyfin/plugins/Playback Analytics'
unzip -o /tmp/Jellyfin.PlaybackAnalytics_1.0.0.0_jf12.zip \
  -d '/var/lib/jellyfin/plugins/Playback Analytics'
chown -R jellyfin:jellyfin '/var/lib/jellyfin/plugins/Playback Analytics'
systemctl restart jellyfin
```

## Runtime requirements

Playback Analytics expects the **Playback Reporting** plugin to be installed and available.

The analytics page itself is read-only and does not open or modify Jellyfin's SQLite databases.
