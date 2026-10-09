import test from 'node:test';
import assert from 'node:assert/strict';
import { libraryPlatformOptions } from '../../src/domain/library-platforms.ts';
import { filterLibrary } from '../../src/domain/library-view.ts';
import { backlogCandidates } from '../../src/domain/backlog.ts';
import type { Game, PlayLog, UserGame } from '../../src/domain/model.ts';
const games = [
  {
    id: 'one',
    title: 'One',
    platforms: ['PC (Microsoft Windows)', 'PlayStation 5'],
    genres: ['RPG'],
  },
  { id: 'two', title: 'Two', platforms: ['PC'], genres: ['RPG'] },
  { id: 'other', title: 'Other', platforms: ['Android'], genres: ['Shooter'] },
] as Game[];
const entries = [
  { id: 'entry1', game_id: 'one', status: 'backlog', updated_at: '2026-01-01' },
  { id: 'entry2', game_id: 'two', status: 'backlog', updated_at: '2026-01-02' },
] as UserGame[];
const logs = [
  { user_game_id: 'entry1', platform_played: 'PC / Steam', hours_played: 1 },
  { user_game_id: 'entry1', platform_played: 'PC / Steam', hours_played: 2 },
  { user_game_id: 'unrelated', platform_played: 'Android', hours_played: 1 },
] as PlayLog[];

test('library options use only owned entry logs, deduplicate and fall back to linked catalogue games', () => {
  assert.deepEqual(libraryPlatformOptions(entries, games, logs), ['PC / Steam']);
  assert.deepEqual(libraryPlatformOptions(entries, games, []), [
    'PC',
    'PC (Microsoft Windows)',
    'PlayStation 5',
  ]);
  assert.deepEqual(libraryPlatformOptions([], games, logs), []);
  assert.deepEqual(
    libraryPlatformOptions(entries, games, [
      { user_game_id: 'entry1', platform_played: ' ' },
    ] as PlayLog[]),
    libraryPlatformOptions(entries, games, []),
  );
});

test('library platform filter prefers actual sessions and falls back per entry with equivalent PC names', () => {
  const filters = {
    query: '',
    status: 'all',
    platform: 'PC / Steam',
    genre: '',
    sort: 'title' as const,
  };
  assert.deepEqual(
    filterLibrary(entries, games, logs, filters).map((entry) => entry.id),
    ['entry1', 'entry2'],
  );
  assert.deepEqual(
    filterLibrary(entries, games, logs, { ...filters, platform: 'PlayStation 5' }),
    [],
  );
  assert.deepEqual(
    filterLibrary(entries, games, [], { ...filters, platform: 'PS5' }).map((entry) => entry.id),
    ['entry1'],
  );
  assert.deepEqual(filterLibrary(entries, games, logs, { ...filters, platform: 'Android' }), []);
});

test('backlog supports played platforms absent from IGDB and compatible entries without logs', () => {
  const played = [{ user_game_id: 'entry1', platform_played: 'PS2' }] as PlayLog[];
  assert.deepEqual(
    backlogCandidates(entries, games, 'PlayStation 2', 'RPG', played).map((game) => game.id),
    ['one'],
  );
  assert.deepEqual(
    backlogCandidates(entries, games, 'PC / Steam', 'RPG', logs).map((game) => game.id),
    ['one', 'two'],
  );
  assert.deepEqual(
    libraryPlatformOptions(
      entries.filter((entry) => entry.id === 'entry2'),
      games,
      logs,
    ),
    ['PC'],
  );
});
