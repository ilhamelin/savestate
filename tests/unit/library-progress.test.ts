import test from 'node:test';
import assert from 'node:assert/strict';
import { achievementPercent, filterLibrary } from '../../src/domain/library-view.ts';
import type { Game, PlayLog, UserGame } from '../../src/domain/model.ts';
test('library progress sorts by best platform and filters exact completion without counting absent data', () => {
  const games = ['A', 'B', 'C', 'D'].map((title) => ({
    id: title,
    title,
    igdb_id: 1,
    slug: title.toLowerCase(),
    cover_url: null,
    release_year: null,
    developer: null,
    publisher: null,
    series: null,
    synopsis: null,
    cached_at: '2026-01-01',
    platforms: ['PC'],
    genres: [],
  })) as Game[];
  const entries = games.map((game) => ({
    id: game.id,
    game_id: game.id,
    status: 'playing',
    rating: null,
    updated_at: '2026-01-01',
  })) as UserGame[];
  const logs = [
    {
      user_game_id: 'A',
      platform_played: 'PC / Steam',
      hours_played: 2,
      console_progress: { kind: 'achievements', current: 999, total: 1000 },
    },
    {
      user_game_id: 'B',
      platform_played: 'Xbox One',
      hours_played: 1,
      console_progress: { kind: 'gamerscore', current: 20, total: 100 },
    },
    {
      user_game_id: 'B',
      platform_played: 'PS5',
      hours_played: 3,
      console_progress: { kind: 'trophies', current: 5, total: 5 },
    },
    {
      user_game_id: 'D',
      platform_played: 'PC',
      hours_played: 0,
      console_progress: { kind: 'achievements', current: 0, total: 5 },
    },
    {
      user_game_id: 'foreign',
      platform_played: 'PC',
      hours_played: 0,
      console_progress: { kind: 'achievements', current: 5, total: 5 },
    },
  ] as PlayLog[];
  const filters = {
    query: '',
    status: 'all',
    platform: '',
    genre: '',
    sort: 'achievements' as const,
  };
  assert.deepEqual(
    filterLibrary(entries, games, logs, filters).map((entry) => entry.id),
    ['B', 'A', 'D', 'C'],
  );
  assert.deepEqual(
    filterLibrary(entries, games, logs, { ...filters, completedAchievements: true }).map(
      (entry) => entry.id,
    ),
    ['B'],
  );
  assert.deepEqual(
    filterLibrary(entries, games, logs, { ...filters, completedAchievements: true, query: 'A' }),
    [],
  );
  assert.deepEqual(
    filterLibrary(entries, games, logs, {
      ...filters,
      completedAchievements: true,
      status: 'backlog',
    }),
    [],
  );
  assert.equal(achievementPercent(logs[0]!), 99.9);
  assert.equal(achievementPercent({ console_progress: null } as PlayLog), null);
  assert.equal(
    achievementPercent({
      console_progress: { kind: 'achievements', current: 0, total: 0 },
    } as PlayLog),
    null,
  );
  assert.deepEqual(
    entries.map((entry) => entry.id),
    ['A', 'B', 'C', 'D'],
  );
});
