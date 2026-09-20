'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const app = require(path.join(
  __dirname,
  '..',
  'src',
  'Jellyfin.Plugin.PlaybackAnalytics',
  'Configuration',
  'playbackAnalytics.js'
));

const {
  normalizeId,
  getItemSize,
  parsePlaybackStats,
  buildItemRows,
  buildSeriesRows
} = app._test;

assert.equal(normalizeId('ABC-123'), 'abc123');
assert.equal(getItemSize({ MediaSources: [{ Path: '/a.mkv', Size: 100 }, { Path: '/a.mkv', Size: 100 }, { Path: '/b.mkv', Size: 50 }] }), 150);

const playback = parsePlaybackStats({
  colums: ['ItemId', 'TotalSeconds', 'Sessions', 'LastWatched', 'LastUserId', 'UserIds'],
  results: [
    ['episode-1', 3600, 2, '2026-09-19 20:00:00', 'user-1', 'user1,user2'],
    ['episode-2', 1800, 1, '2026-09-20 20:00:00', 'user-2', 'user2']
  ]
});

const users = [
  { Id: 'user1', Name: 'User One' },
  { Id: 'user2', Name: 'User Two' }
];

const library = [
  {
    Id: 'episode1',
    Type: 'Episode',
    Name: 'Pilot',
    SeriesId: 'series1',
    SeriesName: 'Example Show',
    SeasonName: 'Season 1',
    ParentIndexNumber: 1,
    IndexNumber: 1,
    MediaSources: [{ Path: '/show/e1.mkv', Size: 1000 }]
  },
  {
    Id: 'episode2',
    Type: 'Episode',
    Name: 'Second',
    SeriesId: 'series1',
    SeriesName: 'Example Show',
    SeasonName: 'Season 1',
    ParentIndexNumber: 1,
    IndexNumber: 2,
    MediaSources: [{ Path: '/show/e2.mkv', Size: 2000 }]
  },
  {
    Id: 'episode3',
    Type: 'Episode',
    Name: 'Never Watched',
    SeriesId: 'series1',
    SeriesName: 'Example Show',
    SeasonName: 'Season 1',
    ParentIndexNumber: 1,
    IndexNumber: 3,
    MediaSources: [{ Path: '/show/e3.mkv', Size: 3000 }]
  },
  {
    Id: 'movie1',
    Type: 'Movie',
    Name: 'Movie',
    MediaSources: [{ Path: '/movie.mkv', Size: 4000 }]
  }
];

const itemRows = buildItemRows(library, playback, users);
assert.equal(itemRows.length, 4);
assert.equal(itemRows[0].EpisodeNumber, 'S01E01');
assert.equal(itemRows[0].TotalHours, 1);
assert.equal(itemRows[2].Sessions, 0);
assert.equal(itemRows[2].Users, '');

const seriesRows = buildSeriesRows(itemRows);
assert.equal(seriesRows.length, 1);
assert.equal(seriesRows[0].SeriesName, 'Example Show');
assert.equal(seriesRows[0].EpisodeCount, 3);
assert.equal(seriesRows[0].WatchedEpisodeCount, 2);
assert.equal(seriesRows[0].UnwatchedEpisodeCount, 1);
assert.equal(seriesRows[0].Sessions, 3);
assert.equal(seriesRows[0].SizeBytes, 6000);
assert.equal(seriesRows[0].LastWatchedBy, 'User Two');
assert.deepEqual(seriesRows[0].UserNames, ['User One', 'User Two']);

console.log('Playback Analytics JavaScript tests passed.');
