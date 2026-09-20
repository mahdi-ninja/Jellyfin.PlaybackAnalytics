# Architecture

Playback Analytics is intentionally a thin Jellyfin dashboard plugin.

## Data sources

The browser dashboard joins three authenticated Jellyfin API calls:

1. `GET /Items`
   - Source of truth for the complete playable library.
   - This is why never-watched items can appear.
   - The request asks for `Movie,Episode,Video,Audio` and `MediaSources` so file sizes can be calculated.

2. `GET /Users`
   - Maps Playback Reporting user IDs to display names.

3. `POST /user_usage_stats/submit_custom_query`
   - Supplied by the official Playback Reporting plugin.
   - Runs a read-only aggregate query over `PlaybackActivity`.
   - Returns total play duration, session count, latest playback and all viewer IDs per item.

No Jellyfin database file is opened by this plugin. No playback database file is opened directly by this plugin.

## Item view

Every playable Jellyfin item becomes one item row. If an item has no Playback Reporting entry, its playback values are zero/blank.

## Series view

Only episode rows are aggregated. Episodes are grouped primarily by Jellyfin `SeriesId` with a series-name fallback.

For each series the UI calculates:

- episode count
- watched episode count
- unwatched episode count
- completion percentage
- total media size
- total viewing hours
- total playback sessions
- latest playback timestamp
- user responsible for the latest playback
- union of all viewers

A series counts an episode as watched when Playback Reporting contains one or more sessions for that episode. This is playback-history analytics, not Jellyfin per-user watched-state analytics.

## Security boundary

Playback Reporting's custom query controller requires Jellyfin's elevated administrator policy. The page uses Jellyfin Web's `ApiClient`, so it reuses the current authenticated session rather than managing API keys or credentials.

## Retention caveat

"Never watched" means "no matching record in the Playback Reporting history currently retained." If Playback Reporting has deleted old records, old playback cannot be reconstructed by this plugin.
