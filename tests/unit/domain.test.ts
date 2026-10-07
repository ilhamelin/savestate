import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rating,
  favorites,
  validatePlayLog,
  safeNext,
  socialLinks,
  date,
  status,
  bool,
} from '../../src/domain/validation.ts';
const id = '11111111-1111-4111-8111-111111111111';
test('puntuación: permite medios puntos y rechaza valores no finitos o fuera de escala', () => {
  for (let value = 1; value <= 10; value += 0.5) assert.equal(rating(value), value);
  for (const value of [0, 10.5, 9.25, NaN, Infinity, '9.5']) assert.throws(() => rating(value));
  assert.equal(rating(null), null);
  assert.throws(() => rating(null, true));
});
test('Top 4: orden conservado, sin duplicados ni quinto favorito', () => {
  assert.deepEqual(favorites([id]), [id]);
  assert.deepEqual(favorites([]), []);
  assert.throws(() => favorites([id, id]));
  assert.throws(() => favorites(Array(5).fill(id)));
});
test('Play Logs: fechas reales, fin posterior al inicio y horas positivas', () => {
  const log = {
    user_game_id: id,
    platform_played: 'SNES',
    play_method: 'emulator',
    hours_played: 32.5,
    start_date: '2024-01-01',
    finish_date: '2024-02-01',
  };
  assert.equal(validatePlayLog(log).hours_played, 32.5);
  assert.throws(() => validatePlayLog({ ...log, finish_date: '2023-01-01' }));
  assert.throws(() => validatePlayLog({ ...log, hours_played: -1 }));
  assert.throws(() => date('2024-02-30'));
  assert.equal(date('2024-02-29'), '2024-02-29');
});
test('redirecciones: evita destinos externos, backslashes y saltos de línea', () => {
  assert.equal(safeNext('/settings'), '/settings');
  for (const url of ['//evil.test', '/\\evil.test', 'https://evil.test', '/\n'])
    assert.equal(safeNext(url), '/library');
});
test('enlaces sociales: rechaza esquemas peligrosos y hosts falsificados', () => {
  assert.equal(
    socialLinks({ github: 'https://github.com/player' }).github,
    'https://github.com/player',
  );
  for (const url of [
    'javascript:alert(1)',
    'https://github.com.evil.test/me',
    'https://me:password@github.com',
  ])
    assert.throws(() => socialLinks({ github: url }));
});
test('estados y spoilers: sin valores implícitos ni estados inventados', () => {
  assert.equal(status('platinum'), 'platinum');
  assert.throws(() => status('paused'));
  assert.throws(() => bool(undefined, 'Spoilers'));
  assert.equal(bool(false, 'Spoilers'), false);
});
