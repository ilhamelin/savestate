import test from 'node:test';
import assert from 'node:assert/strict';
import { showcaseGames } from '../../src/domain/achievements-showcase.ts';
import type { Game, UserGame, PlayLog } from '../../src/domain/model.ts';

test('showcase isolates owned games, filters platform progress and uses exact completion', () => {
  const games = ['A', 'B', 'C'].map((id) => ({ id, title: id })) as Game[];
  const entries = games.map((game) => ({ id: game.id, game_id: game.id })) as UserGame[];
  const logs = [
    {
      id: 'a',
      user_game_id: 'A',
      platform_played: 'PC / Steam',
      hours_played: 2.25,
      console_progress: { kind: 'achievements', current: 999, total: 1000 },
    },
    {
      id: 'b',
      user_game_id: 'B',
      platform_played: 'Xbox One',
      hours_played: 3,
      console_progress: { kind: 'gamerscore', current: 500, total: 1000 },
    },
    {
      id: 'c',
      user_game_id: 'B',
      platform_played: 'PlayStation 5',
      hours_played: 4,
      console_progress: { kind: 'trophies', current: 10, total: 10 },
    },
    {
      id: 'd',
      user_game_id: 'B',
      platform_played: 'Xbox One',
      hours_played: 1,
      console_progress: { kind: 'gamerscore', current: 250, total: 1000 },
    },
    {
      id: 'e',
      user_game_id: 'foreign',
      platform_played: 'PC / Steam',
      hours_played: 999,
      console_progress: { kind: 'achievements', current: 10, total: 10 },
    },
    {
      id: 'f',
      user_game_id: 'C',
      platform_played: 'PC / Steam',
      hours_played: 5,
      console_progress: { kind: 'achievements', current: 0, total: 0 },
    },
  ] as PlayLog[];
  const before = structuredClone(logs);
  const all = showcaseGames(games, entries, logs, 'all', false);
  assert.deepEqual(
    all.map((item) => item.game.id),
    ['B', 'A'],
  );
  assert.equal(all[0]!.hours, 8);
  assert.equal(all[0]!.logs.length, 2);
  assert.deepEqual(
    showcaseGames(games, entries, logs, 'all', true).map((item) => item.game.id),
    ['B'],
  );
  assert.equal(showcaseGames(games, entries, logs, 'steam', true).length, 0);
  assert.equal(showcaseGames(games, entries, logs, 'xbox', true).length, 0);
  const xbox = showcaseGames(games, entries, logs, 'xbox', false);
  assert.equal(xbox[0]!.percent, 50);
  assert.equal(xbox[0]!.logs[0]!.id, 'b');
  assert.equal(showcaseGames(games, entries, logs, 'playstation', true)[0]!.percent, 100);
  assert.deepEqual(logs, before);
});

test('showcase keeps zero unlocked achievements and orders ties by hours deterministically', () => {
  const games = ['A', 'B'].map((id) => ({ id, title: id })) as Game[];
  const entries = games.map((game) => ({ id: game.id, game_id: game.id })) as UserGame[];
  const logs = games.map((game) => ({
    id: game.id,
    user_game_id: game.id,
    platform_played: 'PC / Steam',
    hours_played: game.id === 'A' ? 1 : 2,
    console_progress: { kind: 'achievements', current: 0, total: 5 },
  })) as PlayLog[];
  assert.deepEqual(
    showcaseGames(games, entries, logs, 'steam', false).map((item) => item.game.id),
    ['B', 'A'],
  );
  assert.deepEqual(showcaseGames(games, entries, [], 'all', false), []);
});
