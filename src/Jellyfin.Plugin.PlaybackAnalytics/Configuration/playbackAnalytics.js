(function playbackAnalyticsModule(globalScope) {
  'use strict';

  const PLAYBACK_SQL = `
WITH Ranked AS (
    SELECT
        LOWER(REPLACE(ItemId, '-', '')) AS ItemId,
        UserId,
        DateCreated,
        ROW_NUMBER() OVER (
            PARTITION BY LOWER(REPLACE(ItemId, '-', ''))
            ORDER BY DateCreated DESC, rowid DESC
        ) AS rn
    FROM PlaybackActivity
),
Summary AS (
    SELECT
        LOWER(REPLACE(ItemId, '-', '')) AS ItemId,
        SUM(
            CASE
                WHEN PlayDuration > 0 THEN PlayDuration
                ELSE 0
            END
        ) AS TotalSeconds,
        COUNT(*) AS Sessions,
        GROUP_CONCAT(DISTINCT LOWER(REPLACE(UserId, '-', ''))) AS UserIds
    FROM PlaybackActivity
    GROUP BY LOWER(REPLACE(ItemId, '-', ''))
)
SELECT
    s.ItemId,
    s.TotalSeconds,
    s.Sessions,
    r.DateCreated AS LastWatched,
    r.UserId AS LastUserId,
    s.UserIds
FROM Summary s
LEFT JOIN Ranked r
    ON r.ItemId = s.ItemId
   AND r.rn = 1
`.trim();

  const ITEM_COLUMNS = [
    { key: 'Name', label: 'Name', className: 'pa-name pa-wrap' },
    { key: 'Type', label: 'Type' },
    { key: 'SeriesName', label: 'Series', className: 'pa-wrap' },
    { key: 'SeasonName', label: 'Season', className: 'pa-wrap' },
    { key: 'EpisodeNumber', label: 'Episode' },
    { key: 'ProductionYear', label: 'Year' },
    { key: 'SizeBytes', label: 'Size', format: 'bytes' },
    { key: 'TotalHours', label: 'Hours', format: 'hours' },
    { key: 'Sessions', label: 'Sessions', format: 'integer' },
    { key: 'LastWatched', label: 'Last watched', format: 'date' },
    { key: 'LastWatchedBy', label: 'Last watched by', className: 'pa-wrap' },
    { key: 'Users', label: 'Viewers', className: 'pa-wrap' }
  ];

  const SERIES_COLUMNS = [
    { key: 'SeriesName', label: 'Series', className: 'pa-name pa-wrap' },
    { key: 'EpisodeCount', label: 'Episodes', format: 'integer' },
    { key: 'WatchedEpisodeCount', label: 'Watched', format: 'integer' },
    { key: 'UnwatchedEpisodeCount', label: 'Unwatched', format: 'integer' },
    { key: 'CompletionPercent', label: 'Completion', format: 'percent' },
    { key: 'SizeBytes', label: 'Size', format: 'bytes' },
    { key: 'TotalHours', label: 'Hours', format: 'hours' },
    { key: 'Sessions', label: 'Sessions', format: 'integer' },
    { key: 'LastWatched', label: 'Last watched', format: 'date' },
    { key: 'LastWatchedBy', label: 'Last watched by', className: 'pa-wrap' },
    { key: 'Users', label: 'Viewers', className: 'pa-wrap' }
  ];

  const pageStates = new WeakMap();

  function normalizeId(value) {
    return String(value || '').replaceAll('-', '').toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatBytes(bytes) {
    const numeric = Number(bytes) || 0;
    if (numeric <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const index = Math.min(
      Math.floor(Math.log(numeric) / Math.log(1024)),
      units.length - 1
    );
    const value = numeric / Math.pow(1024, index);
    return `${value.toFixed(index >= 3 ? 2 : 1)} ${units[index]}`;
  }

  function formatDate(value) {
    if (!value) {
      return '';
    }

    const normalized = String(value).includes('T')
      ? String(value)
      : String(value).replace(' ', 'T');
    const parsed = new Date(normalized);

    if (Number.isNaN(parsed.getTime())) {
      return String(value);
    }

    return parsed.toLocaleString();
  }

  function getItemSize(item) {
    const directSize = Number(item?.Size) || 0;
    const sources = Array.isArray(item?.MediaSources) ? item.MediaSources : [];

    if (sources.length === 0) {
      return directSize;
    }

    const seen = new Set();
    let total = 0;

    for (const source of sources) {
      const key = String(source?.Path || source?.Id || `${source?.Container || ''}:${source?.Size || ''}`);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      total += Number(source?.Size) || 0;
    }

    return total || directSize;
  }

  function episodeNumber(item) {
    const season = Number(item?.ParentIndexNumber);
    const episode = Number(item?.IndexNumber);

    if (Number.isFinite(season) && Number.isFinite(episode)) {
      return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
    }

    if (Number.isFinite(episode)) {
      return String(episode);
    }

    return '';
  }

  function parsePlaybackStats(response) {
    const columns = response?.colums || response?.columns || [];
    const rows = response?.results || [];
    const result = new Map();

    for (const row of rows) {
      const entry = {};
      columns.forEach((column, index) => {
        entry[column] = row[index];
      });

      result.set(normalizeId(entry.ItemId), entry);
    }

    return result;
  }

  function makeUserMap(users) {
    const map = new Map();

    for (const user of users || []) {
      map.set(normalizeId(user?.Id), user?.Name || user?.Username || 'Unknown user');
    }

    return map;
  }

  function resolveUser(userMap, userId) {
    if (!userId) {
      return '';
    }

    const normalized = normalizeId(userId);
    return userMap.get(normalized) || `Unknown (${normalized})`;
  }

  function splitUserIds(value) {
    return [...new Set(
      String(value || '')
        .split(',')
        .map(normalizeId)
        .filter(Boolean)
    )];
  }

  function buildItemRows(libraryItems, playbackMap, users) {
    const userMap = makeUserMap(users);

    return (libraryItems || []).map((item) => {
      const stats = playbackMap.get(normalizeId(item?.Id));
      const totalSeconds = Math.max(0, Number(stats?.TotalSeconds) || 0);
      const viewerNames = splitUserIds(stats?.UserIds)
        .map((id) => resolveUser(userMap, id))
        .sort((a, b) => a.localeCompare(b));
      const sizeBytes = getItemSize(item);

      return {
        ItemId: item?.Id || '',
        Type: item?.Type || '',
        Name: item?.Name || '',
        SeriesId: item?.SeriesId || '',
        SeriesName: item?.SeriesName || '',
        SeasonName: item?.SeasonName || '',
        EpisodeNumber: episodeNumber(item),
        ProductionYear: item?.ProductionYear || '',
        SizeBytes: sizeBytes,
        SizeGB: sizeBytes / 1024 / 1024 / 1024,
        TotalHours: totalSeconds / 3600,
        Sessions: Math.max(0, Number(stats?.Sessions) || 0),
        LastWatched: stats?.LastWatched || '',
        LastWatchedBy: resolveUser(userMap, stats?.LastUserId),
        Users: viewerNames.join(', '),
        UserNames: viewerNames
      };
    });
  }

  function dateScore(value) {
    if (!value) {
      return Number.NEGATIVE_INFINITY;
    }

    const normalized = String(value).includes('T')
      ? String(value)
      : String(value).replace(' ', 'T');
    const parsed = new Date(normalized).getTime();
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  }

  function buildSeriesRows(itemRows) {
    const groups = new Map();

    for (const item of itemRows || []) {
      if (item.Type !== 'Episode') {
        continue;
      }

      const seriesKey = normalizeId(item.SeriesId)
        || `name:${String(item.SeriesName || '').trim().toLowerCase()}`;

      if (!groups.has(seriesKey)) {
        groups.set(seriesKey, {
          SeriesId: item.SeriesId || '',
          SeriesName: item.SeriesName || '(Unknown series)',
          EpisodeCount: 0,
          WatchedEpisodeCount: 0,
          UnwatchedEpisodeCount: 0,
          CompletionPercent: 0,
          SizeBytes: 0,
          TotalHours: 0,
          Sessions: 0,
          LastWatched: '',
          LastWatchedBy: '',
          Users: '',
          UserNames: [],
          _userSet: new Set(),
          _lastWatchedScore: Number.NEGATIVE_INFINITY
        });
      }

      const row = groups.get(seriesKey);
      row.EpisodeCount += 1;
      row.SizeBytes += Number(item.SizeBytes) || 0;
      row.TotalHours += Number(item.TotalHours) || 0;
      row.Sessions += Number(item.Sessions) || 0;

      if ((Number(item.Sessions) || 0) > 0) {
        row.WatchedEpisodeCount += 1;
      } else {
        row.UnwatchedEpisodeCount += 1;
      }

      for (const userName of item.UserNames || []) {
        row._userSet.add(userName);
      }

      const score = dateScore(item.LastWatched);
      if (score > row._lastWatchedScore) {
        row._lastWatchedScore = score;
        row.LastWatched = item.LastWatched || '';
        row.LastWatchedBy = item.LastWatchedBy || '';
      }
    }

    return [...groups.values()].map((row) => {
      row.CompletionPercent = row.EpisodeCount > 0
        ? (row.WatchedEpisodeCount / row.EpisodeCount) * 100
        : 0;
      row.UserNames = [...row._userSet].sort((a, b) => a.localeCompare(b));
      row.Users = row.UserNames.join(', ');
      delete row._userSet;
      delete row._lastWatchedScore;
      return row;
    });
  }

  async function getLibraryItems() {
    const userId = typeof ApiClient.getCurrentUserId === 'function'
      ? ApiClient.getCurrentUserId()
      : undefined;

    const url = ApiClient.getUrl('Items', {
      UserId: userId,
      Recursive: true,
      IncludeItemTypes: 'Movie,Episode,Video,Audio',
      Fields: 'MediaSources',
      EnableTotalRecordCount: false
    });

    const result = await ApiClient.getJSON(url);
    return result?.Items || result?.items || [];
  }

  async function getUsers() {
    const result = await ApiClient.getJSON(ApiClient.getUrl('Users'));
    return Array.isArray(result) ? result : (result?.Items || []);
  }

  async function getPlaybackStats() {
    return ApiClient.ajax({
      type: 'POST',
      url: ApiClient.getUrl('user_usage_stats/submit_custom_query'),
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify({
        CustomQueryString: PLAYBACK_SQL,
        ReplaceUserId: false
      })
    });
  }

  function createState() {
    return {
      itemRows: [],
      seriesRows: [],
      activeView: 'items',
      sortColumn: 'TotalHours',
      sortDirection: 'desc',
      loading: false
    };
  }

  function getState(page) {
    if (!pageStates.has(page)) {
      pageStates.set(page, createState());
    }
    return pageStates.get(page);
  }

  function setText(page, id, value) {
    const element = page.querySelector(`#${id}`);
    if (element) {
      element.textContent = value;
    }
  }

  function updateSummary(page, state) {
    const rows = state.itemRows;
    const unwatched = rows.filter((row) => row.Sessions === 0);
    const totalStorage = rows.reduce((sum, row) => sum + row.SizeBytes, 0);
    const unwatchedStorage = unwatched.reduce((sum, row) => sum + row.SizeBytes, 0);
    const totalHours = rows.reduce((sum, row) => sum + row.TotalHours, 0);

    setText(page, 'paTotalItems', rows.length.toLocaleString());
    setText(page, 'paUnwatchedItems', unwatched.length.toLocaleString());
    setText(page, 'paSeriesCount', state.seriesRows.length.toLocaleString());
    setText(page, 'paTotalStorage', formatBytes(totalStorage));
    setText(page, 'paUnwatchedStorage', formatBytes(unwatchedStorage));
    setText(page, 'paTotalHours', totalHours.toFixed(1));
  }

  function setWatchFilterOptions(page, view) {
    const select = page.querySelector('#paWatchFilter');
    const previous = select.value;

    if (view === 'series') {
      select.innerHTML = `
        <option value="all">All series</option>
        <option value="unwatched">Never watched</option>
        <option value="started">Partially watched</option>
        <option value="complete">All episodes watched</option>
      `;
    } else {
      select.innerHTML = `
        <option value="all">All items</option>
        <option value="watched">Watched</option>
        <option value="unwatched">Never watched</option>
      `;
    }

    if ([...select.options].some((option) => option.value === previous)) {
      select.value = previous;
    }
  }

  function setActiveView(page, state, view) {
    state.activeView = view;
    state.sortColumn = view === 'series' ? 'SizeBytes' : 'TotalHours';
    state.sortDirection = 'desc';

    page.querySelectorAll('.pa-tab').forEach((button) => {
      button.classList.toggle('pa-active', button.dataset.view === view);
    });

    page.querySelector('#paTypeControl').classList.toggle('pa-hidden', view === 'series');
    setWatchFilterOptions(page, view);
    render(page, state);
  }

  function statusMatches(row, state, filter) {
    if (filter === 'all') {
      return true;
    }

    if (state.activeView === 'items') {
      if (filter === 'watched') {
        return row.Sessions > 0;
      }
      if (filter === 'unwatched') {
        return row.Sessions === 0;
      }
      return true;
    }

    if (filter === 'unwatched') {
      return row.WatchedEpisodeCount === 0;
    }
    if (filter === 'started') {
      return row.WatchedEpisodeCount > 0 && row.WatchedEpisodeCount < row.EpisodeCount;
    }
    if (filter === 'complete') {
      return row.EpisodeCount > 0 && row.WatchedEpisodeCount === row.EpisodeCount;
    }

    return true;
  }

  function searchableText(row, view) {
    const values = view === 'series'
      ? [row.SeriesName, row.Users, row.LastWatchedBy]
      : [row.Name, row.SeriesName, row.SeasonName, row.EpisodeNumber, row.Users, row.LastWatchedBy];

    return values.join(' ').toLowerCase();
  }

  function compareValues(a, b, direction) {
    if (typeof a === 'number' && typeof b === 'number') {
      return (a - b) * direction;
    }

    if (a === b) {
      return 0;
    }

    if (a === null || a === undefined || a === '') {
      return 1;
    }
    if (b === null || b === undefined || b === '') {
      return -1;
    }

    return String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: 'base'
    }) * direction;
  }

  function getFilteredRows(page, state) {
    const search = page.querySelector('#paSearch').value.trim().toLowerCase();
    const watchFilter = page.querySelector('#paWatchFilter').value;
    const typeFilter = page.querySelector('#paTypeFilter').value;
    const source = state.activeView === 'series' ? state.seriesRows : state.itemRows;

    const rows = source.filter((row) => {
      if (!statusMatches(row, state, watchFilter)) {
        return false;
      }

      if (state.activeView === 'items' && typeFilter !== 'all' && row.Type !== typeFilter) {
        return false;
      }

      if (search && !searchableText(row, state.activeView).includes(search)) {
        return false;
      }

      return true;
    });

    const direction = state.sortDirection === 'asc' ? 1 : -1;
    const key = state.sortColumn;
    rows.sort((left, right) => compareValues(left[key], right[key], direction));
    return rows;
  }

  function formatCell(row, column) {
    const value = row[column.key];

    switch (column.format) {
      case 'bytes':
        return formatBytes(value);
      case 'hours':
        return (Number(value) || 0).toFixed(2);
      case 'integer':
        return (Number(value) || 0).toLocaleString();
      case 'date':
        return formatDate(value);
      case 'percent': {
        const percent = Math.min(100, Math.max(0, Number(value) || 0));
        return `${percent.toFixed(1)}%<div class="pa-progress-bar"><div class="pa-progress-fill" style="width:${percent.toFixed(2)}%"></div></div>`;
      }
      default:
        return escapeHtml(value);
    }
  }

  function renderTableHead(page, state) {
    const columns = state.activeView === 'series' ? SERIES_COLUMNS : ITEM_COLUMNS;
    const header = page.querySelector('#paTableHead');

    header.innerHTML = `<tr>${columns.map((column) => {
      const indicator = state.sortColumn === column.key
        ? (state.sortDirection === 'asc' ? ' ▲' : ' ▼')
        : '';
      return `<th data-sort="${escapeHtml(column.key)}" class="${column.className || ''}">${escapeHtml(column.label)}${indicator}</th>`;
    }).join('')}</tr>`;

    header.querySelectorAll('th[data-sort]').forEach((element) => {
      element.addEventListener('click', () => {
        const column = element.dataset.sort;
        if (state.sortColumn === column) {
          state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortColumn = column;
          state.sortDirection = 'asc';
        }
        render(page, state);
      });
    });
  }

  function render(page, state) {
    renderTableHead(page, state);

    const rows = getFilteredRows(page, state);
    const columns = state.activeView === 'series' ? SERIES_COLUMNS : ITEM_COLUMNS;
    const body = page.querySelector('#paRows');
    const empty = page.querySelector('#paEmpty');

    body.innerHTML = rows.map((row) => {
      const unwatched = state.activeView === 'series'
        ? row.WatchedEpisodeCount === 0
        : row.Sessions === 0;

      return `<tr class="${unwatched ? 'pa-unwatched' : ''}">${columns.map((column) => {
        const cellClass = column.className || (column.format === 'percent' ? 'pa-progress' : '');
        return `<td class="${cellClass}">${formatCell(row, column)}</td>`;
      }).join('')}</tr>`;
    }).join('');

    empty.classList.toggle('pa-hidden', rows.length !== 0);
    setText(
      page,
      'paStatus',
      `${rows.length.toLocaleString()} ${state.activeView === 'series' ? 'series' : 'items'} shown`
    );
  }

  function describeError(error) {
    const status = error?.status || error?.statusCode || error?.response?.status;
    const message = error?.message || error?.statusText || String(error || 'Unknown error');

    if (status === 404) {
      return 'Playback Reporting could not be reached. Confirm the official Playback Reporting plugin is installed and active.';
    }
    if (status === 401 || status === 403) {
      return 'Playback Analytics requires an administrator session with elevated access.';
    }

    return `Playback Analytics failed to load: ${message}`;
  }

  async function load(page, state) {
    if (state.loading) {
      return;
    }

    state.loading = true;
    page.querySelector('#paError').textContent = '';
    page.querySelector('#paRefresh').disabled = true;
    setText(page, 'paStatus', 'Loading library, users and playback history…');

    try {
      const [libraryItems, users, playbackResponse] = await Promise.all([
        getLibraryItems(),
        getUsers(),
        getPlaybackStats()
      ]);

      const playbackMap = parsePlaybackStats(playbackResponse);
      state.itemRows = buildItemRows(libraryItems, playbackMap, users);
      state.seriesRows = buildSeriesRows(state.itemRows);

      updateSummary(page, state);
      render(page, state);
      page.querySelector('#paRetentionWarning').classList.remove('pa-hidden');
      setText(page, 'paLastRefresh', `Updated ${new Date().toLocaleString()}`);
    } catch (error) {
      console.error('[Playback Analytics] load failed', error);
      page.querySelector('#paError').textContent = describeError(error);
      setText(page, 'paStatus', 'Unable to load report.');
    } finally {
      state.loading = false;
      page.querySelector('#paRefresh').disabled = false;
    }
  }

  function csvEscape(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function exportCsv(page, state) {
    const rows = getFilteredRows(page, state);
    const isSeries = state.activeView === 'series';

    const columns = isSeries
      ? [
        'SeriesId',
        'SeriesName',
        'EpisodeCount',
        'WatchedEpisodeCount',
        'UnwatchedEpisodeCount',
        'CompletionPercent',
        'SizeBytes',
        'SizeGB',
        'TotalHours',
        'Sessions',
        'LastWatched',
        'LastWatchedBy',
        'Users'
      ]
      : [
        'ItemId',
        'Type',
        'Name',
        'SeriesName',
        'SeasonName',
        'EpisodeNumber',
        'ProductionYear',
        'SizeBytes',
        'SizeGB',
        'TotalHours',
        'Sessions',
        'LastWatched',
        'LastWatchedBy',
        'Users'
      ];

    const lines = [columns.join(',')];
    for (const row of rows) {
      lines.push(columns.map((column) => {
        if (column === 'SizeGB') {
          return csvEscape(((Number(row.SizeBytes) || 0) / 1024 / 1024 / 1024).toFixed(2));
        }
        if (column === 'TotalHours') {
          return csvEscape((Number(row.TotalHours) || 0).toFixed(2));
        }
        if (column === 'CompletionPercent') {
          return csvEscape((Number(row.CompletionPercent) || 0).toFixed(2));
        }
        return csvEscape(row[column]);
      }).join(','));
    }

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-') + '_' + [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join('-');

    link.href = url;
    link.download = `jellyfin-playback-analytics-${state.activeView}-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function bind(page, state) {
    if (page.dataset.playbackAnalyticsBound === 'true') {
      return;
    }

    page.dataset.playbackAnalyticsBound = 'true';

    page.querySelector('#paRefresh').addEventListener('click', () => load(page, state));
    page.querySelector('#paExport').addEventListener('click', () => exportCsv(page, state));
    page.querySelector('#paSearch').addEventListener('input', () => render(page, state));
    page.querySelector('#paWatchFilter').addEventListener('change', () => render(page, state));
    page.querySelector('#paTypeFilter').addEventListener('change', () => render(page, state));

    page.querySelectorAll('.pa-tab').forEach((button) => {
      button.addEventListener('click', () => setActiveView(page, state, button.dataset.view));
    });

    page.addEventListener('pageshow', () => {
      if (state.itemRows.length === 0 && !state.loading) {
        load(page, state);
      }
    });
  }

  function init(page) {
    if (!page) {
      return;
    }

    const state = getState(page);
    bind(page, state);
    setWatchFilterOptions(page, state.activeView);
    renderTableHead(page, state);

    if (state.itemRows.length === 0 && !state.loading) {
      load(page, state);
    } else {
      updateSummary(page, state);
      render(page, state);
    }
  }

  const api = {
    init,
    _test: {
      normalizeId,
      formatBytes,
      getItemSize,
      parsePlaybackStats,
      buildItemRows,
      buildSeriesRows,
      dateScore
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (globalScope) {
    globalScope.PlaybackAnalyticsApp = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
