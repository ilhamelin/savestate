import test from 'node:test';
import assert from 'node:assert/strict';
import { backlogCandidates, chooseBacklog } from '../../src/domain/backlog.ts';
import type { Game, UserGame } from '../../src/domain/model.ts';
const games = [
  { id: 'one', platforms: ['SNES'], genres: ['RPG'] },
  { id: 'two', platforms: ['PC'], genres: ['Shooter'] },
  { id: 'three', platforms: ['SNES'], genres: ['RPG'] },
] as Game[];
const entries = [
  { game_id: 'one', status: 'backlog' },
  { game_id: 'two', status: 'backlog' },
  { game_id: 'three', status: 'cleared' },
] as UserGame[];
test('backlog: intersecta plataforma y género sin incluir juegos completados', () => {
  assert.deepEqual(
    backlogCandidates(entries, games).map((game) => game.id),
    ['one', 'two'],
  );
  assert.deepEqual(
    backlogCandidates(entries, games, 'SNES', 'RPG').map((game) => game.id),
    ['one'],
  );
  assert.deepEqual(backlogCandidates(entries, games, 'PC', 'RPG'), []);
  assert.deepEqual(backlogCandidates([], games), []);
});
test('backlog: selección alcanza ambos extremos y maneja conjunto vacío', () => {
  assert.equal(
    chooseBacklog([], () => 0),
    null,
  );
  assert.equal(chooseBacklog(games, () => 0)?.id, 'one');
  assert.equal(chooseBacklog(games, () => 0.999)?.id, 'three');
  assert.throws(() => chooseBacklog(games, () => 1));
  assert.throws(() => chooseBacklog(games, () => NaN));
});
