import test from 'node:test';
import assert from 'node:assert/strict';
import { annualWrapped, wrappedYear } from '../../src/domain/wrapped.ts';
import type { Activity, Game, PlayLog, UserGame } from '../../src/domain/model.ts';
const events = (values: [string, string, string][]) =>
  values.map(([game, date, status], index) => ({
    id: String(index),
    user_id: 'fixture-user',
    target_game_id: game,
    created_at: date,
    event_type: 'library_updated',
    event_data: { status },
  })) as Activity[];
test('Wrapped: fechas, estados sin duplicación, GOTY estable y porcentajes suman 100', () => {
  const entries = [
    { id: 'a', game_id: 'one', rating: 9.5, favorite_position: 2 },
    { id: 'b', game_id: 'two', rating: 9.5, favorite_position: 1 },
    { id: 'c', game_id: 'three', rating: 10, favorite_position: null },
  ] as UserGame[];
  const games = [
    { id: 'one', title: 'One', slug: 'one', genres: ['RPG', 'Adventure'] },
    { id: 'two', title: 'Two', slug: 'two', genres: ['RPG'] },
    { id: 'three', title: 'Three', slug: 'three', genres: ['Action'] },
  ] as Game[];
  const activity = events([
    ['one', '2025-12-31T23:59:59Z', 'backlog'],
    ['one', '2026-02-01T00:00:00Z', 'cleared'],
    ['one', '2026-03-01T00:00:00Z', 'platinum'],
    ['one', '2026-04-01T00:00:00Z', 'platinum'],
    ['two', '2026-02-04T00:00:00Z', 'playing'],
    ['three', '2026-01-01T00:00:00Z', 'backlog'],
  ]);
  const summary = annualWrapped(2026, entries, games, [], activity);
  assert.equal(summary.registered, 2);
  assert.equal(summary.played, 2);
  assert.equal(summary.completed, 1);
  assert.equal(summary.peakMonth, 1);
  assert.equal(summary.goty?.title, 'Two');
  assert.deepEqual(summary.genres, [
    { name: 'RPG', percent: 75 },
    { name: 'Adventure', percent: 25 },
  ]);
  const empty = annualWrapped(2024, entries, games, [], activity);
  assert.equal(empty.played, 0);
  assert.equal(empty.goty, null);
  assert.equal(empty.peakMonth, null);
  assert.throws(() => wrappedYear('2027', 2026));
  assert.throws(() => wrappedYear('2026.5', 2026));
  assert.equal(wrappedYear(undefined, 2026), 2026);
});
test('Wrapped: excluye horas históricas Steam y partidas ajenas; fin real define el mes', () => {
  const entries = [{ id: 'a', game_id: 'one', rating: null, favorite_position: 1 }] as UserGame[];
  const games = [
    { id: 'one', title: 'One', slug: 'one', genres: ['RPG', 'Action', 'Adventure'] },
  ] as Game[];
  const logs = [
    {
      user_game_id: 'a',
      hours_played: 1000,
      note: '[Steam lifetime:1]',
      created_at: '2026-10-08T00:00:00Z',
      start_date: null,
      finish_date: null,
    },
    {
      user_game_id: 'a',
      hours_played: 20,
      note: '',
      created_at: '2026-10-08T00:00:00Z',
      start_date: '2026-01-01',
      finish_date: '2026-03-01',
    },
    { user_game_id: 'hidden', hours_played: 900, note: '', created_at: '2026-01-01' },
  ] as PlayLog[];
  const summary = annualWrapped(
    2026,
    entries,
    games,
    logs,
    events([['one', '2026-10-01T00:00:00Z', 'cleared']]),
  );
  assert.equal(summary.hours, 20);
  assert.equal(summary.completed, 1);
  assert.equal(summary.peakMonth, 2);
  assert.equal(
    summary.genres.reduce((total, genre) => total + genre.percent, 0),
    100,
  );
  assert.equal(summary.goty?.title, 'One');
});
