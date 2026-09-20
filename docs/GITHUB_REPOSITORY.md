# GitHub repository and Jellyfin Catalog setup

This project can use the same public GitHub repository for source code, release binaries, and the Jellyfin plugin repository manifest.

## What is automated

When a tag beginning with `v` is pushed, `.github/workflows/release.yml`:

1. checks out that tag
2. verifies that its version matches `build.yaml`
3. runs the JavaScript tests and static checks
4. builds the .NET 10 plugin
5. packages the DLL and `meta.json` into a ZIP
6. calculates the ZIP's MD5 checksum required by the Jellyfin repository manifest
7. creates or updates a GitHub Release for that tag
8. uploads the ZIP as a release asset
9. switches to the repository's default branch
10. adds/replaces the version in `manifest.json`
11. commits and pushes `manifest.json`

The workflow derives the GitHub `owner/repository` value from the GitHub Actions environment, so there are no repository URL placeholders to edit in the code.

## First release

The initial version is `1.0.0.0`.

```bash
git tag v1.0.0.0
git push origin v1.0.0.0
```

A three-component tag is also accepted when the fourth component is zero:

```bash
git tag v1.0.0
git push origin v1.0.0
```

After the **Release** workflow succeeds, `manifest.json` will contain an entry similar to:

```json
{
  "version": "1.0.0.0",
  "changelog": "Release 1.0.0.0. See the GitHub release notes for details.",
  "targetAbi": "12.0.0.0",
  "sourceUrl": "https://github.com/OWNER/REPO/releases/download/v1.0.0.0/Jellyfin.PlaybackAnalytics_1.0.0.0_jf12.zip",
  "checksum": "<md5>",
  "timestamp": "<utc timestamp>"
}
```

## Jellyfin repository URL

Use the raw `manifest.json` URL from your default branch:

```text
https://raw.githubusercontent.com/OWNER/REPO/main/manifest.json
```

Add it in:

```text
Jellyfin Dashboard -> Plugins -> Repositories
```

After Jellyfin refreshes the catalog, install **Playback Analytics** from the Catalog.

## Repository permissions

The release workflow declares:

```yaml
permissions:
  contents: write
```

This is required to create GitHub Releases and commit the generated `manifest.json`.

For a normal personal public repository this normally works without additional secrets. If your organization restricts `GITHUB_TOKEN` write access or protects the default branch from GitHub Actions, allow the Actions bot to write to the branch or update `manifest.json` manually using the generated release metadata.

No personal access token is required by the default setup.

## Manual rerun

The Release workflow supports `workflow_dispatch`.

In GitHub:

```text
Actions -> Release -> Run workflow
```

Enter an existing tag such as:

```text
v1.0.0.0
```

The workflow is intentionally idempotent:

- if the GitHub Release already exists, its ZIP is replaced
- if the manifest already contains that version, the version entry is replaced rather than duplicated

## New releases

Before creating the next tag, update `version` in `build.yaml` and the corresponding version fields in:

```text
src/Jellyfin.Plugin.PlaybackAnalytics/Jellyfin.Plugin.PlaybackAnalytics.csproj
```

Then commit the version bump and tag that commit.

The release workflow deliberately rejects a tag whose version does not match `build.yaml`; this prevents publishing a ZIP with misleading version metadata.

## Why manifest.json starts with no versions

The committed source ZIP has no real GitHub release URL yet because it does not know where you will host it.

`manifest.json` therefore begins with the plugin metadata and an empty `versions` array. The first successful GitHub release fills in the real repository URL and checksum automatically.
