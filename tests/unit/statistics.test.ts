import test from 'node:test';
import assert from 'node:assert/strict';
import { playerStatistics } from '../../src/domain/statistics.ts';
import type { UserGame, Game, PlayLog } from '../../src/domain/model.ts';
test('estadísticas: suma rejugadas por año sin contar logs ajenos a los registros visibles', () => {
  const entries = [{ id: 'entry', game_id: 'game' }] as UserGame[];
  const games = [{ id: 'game', genres: ['RPG'] }] as Game[];
  const logs = [
    {
      user_game_id: 'entry',
      hours_played: 20,
      platform_played: 'SNES',
      start_date: '2015-01-01',
      finish_date: '2015-03-01',
    },
    {
      user_game_id: 'entry',
      hours_played: 10,
      platform_played: 'Emulador',
      start_date: '2024-01-01',
      finish_date: null,
    },
    { user_game_id: 'hidden', hours_played: 999, platform_played: 'PC', start_date: '2024-01-01' },
  ] as PlayLog[];
  const stats = playerStatistics(entries, games, logs);
  assert.equal(stats.hours, 30);
  assert.deepEqual(stats.genres, [['RPG', 30]]);
  assert.deepEqual(stats.years, [
    ['2024', { hours: 10, completed: 0 }],
    ['2015', { hours: 20, completed: 1 }],
  ]);
});
