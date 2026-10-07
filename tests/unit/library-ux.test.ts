import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLibrary } from '../../src/domain/library-view.ts';
import { sessionMinutes, accumulatedHours } from '../../src/domain/quick-session.ts';
import { parseReviewDraft } from '../../src/domain/review-draft.ts';
import type { Game, UserGame, PlayLog } from '../../src/domain/model.ts';
test('biblioteca: combina filtros, ignora acentos y ordena notas/horas sin mutar entradas', () => {
  const games = [
    { id: 'g1', title: 'Pokémon', platforms: ['GB'], genres: ['RPG'] },
    { id: 'g2', title: 'Halo', platforms: ['PC'], genres: ['Shooter'] },
    { id: 'g3', title: 'Chrono Trigger', platforms: ['SNES'], genres: ['RPG'] },
  ] as Game[];
  const entries = [
    { id: 'a', game_id: 'g1', status: 'playing', rating: null, updated_at: '2026-01-01' },
    { id: 'b', game_id: 'g2', status: 'cleared', rating: 9.5, updated_at: '2026-01-03' },
    { id: 'c', game_id: 'g3', status: 'playing', rating: 9, updated_at: '2026-01-02' },
    { id: 'd', game_id: 'missing', status: 'playing', rating: 10, updated_at: '2026-01-04' },
  ] as UserGame[];
  const logs = [
    { user_game_id: 'a', hours_played: 10 },
    { user_game_id: 'a', hours_played: 12 },
    { user_game_id: 'b', hours_played: 8 },
    { user_game_id: 'c', hours_played: 21 },
    { user_game_id: 'other', hours_played: 10000 },
  ] as PlayLog[];
  const filters = { query: '', status: 'all', platform: '', genre: '', sort: 'updated' as const };
  const ids = (values: UserGame[]) => values.map((entry) => entry.id);
  assert.deepEqual(ids(filterLibrary(entries, games, logs, filters)), ['b', 'c', 'a']);
  assert.deepEqual(
    ids(
      filterLibrary(entries, games, logs, {
        ...filters,
        query: ' POKEMON ',
        status: 'playing',
        platform: 'GB',
        genre: 'RPG',
      }),
    ),
    ['a'],
  );
  assert.deepEqual(
    filterLibrary(entries, games, logs, { ...filters, platform: 'PC', genre: 'RPG' }),
    [],
  );
  assert.deepEqual(ids(filterLibrary(entries, games, logs, { ...filters, sort: 'title' })), [
    'c',
    'b',
    'a',
  ]);
  assert.deepEqual(ids(filterLibrary(entries, games, logs, { ...filters, sort: 'rating' })), [
    'b',
    'c',
    'a',
  ]);
  assert.deepEqual(ids(filterLibrary(entries, games, logs, { ...filters, sort: 'hours' })), [
    'a',
    'c',
    'b',
  ]);
  assert.deepEqual(ids(entries), ['a', 'b', 'c', 'd']);
});
test('sesiones: valida minutos y respeta precisión y límite de horas del esquema', () => {
  assert.equal(accumulatedHours(10.25, 90), 11.75);
  assert.equal(accumulatedHours(0, 1), 0.02);
  assert.equal(accumulatedHours(99976, 1440), 100000);
  for (const value of [0, -1, 1441, 1.5, NaN, Infinity, '90', null])
    assert.throws(() => sessionMinutes(value));
  assert.throws(() => accumulatedHours(99999.99, 1));
  assert.throws(() => accumulatedHours(NaN, 60));
  assert.throws(() => accumulatedHours(-1, 60));
});
test('borradores: descarta datos corruptos, versiones desconocidas y notas inválidas', () => {
  const valid = { version: 1, content: '**Hola**', rating: '9.5', spoilers: 'yes', revision: null };
  assert.deepEqual(parseReviewDraft(JSON.stringify(valid)), valid);
  for (const raw of [
    null,
    '{',
    'null',
    JSON.stringify({ ...valid, version: 2 }),
    JSON.stringify({ ...valid, content: 'x'.repeat(10001) }),
    JSON.stringify({ ...valid, rating: '9.3' }),
    JSON.stringify({ ...valid, spoilers: true }),
    JSON.stringify({ ...valid, revision: {} }),
  ])
    assert.equal(parseReviewDraft(raw), null);
  assert.equal(
    parseReviewDraft(JSON.stringify({ ...valid, content: '<script>alert(1)</script>' }))?.content,
    '<script>alert(1)</script>',
  );
  // Drafts are text only; the server sanitizes their preview and published HTML.
});
