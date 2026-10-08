import test from 'node:test';
import assert from 'node:assert/strict';
import {
  duelPercentages,
  partyInput,
  remainingPartyTime,
  roomTheme,
} from '../../src/domain/arcade.ts';
const input = {
  game_id: '00000000-0000-0000-0000-000000000001',
  platform: 'PC',
  playstyle: 'casual',
  schedule: 'Viernes 21:00 GMT-3',
  contact_note: 'Discord: @player',
};
test('arcade: porcentajes complementarios, empate y ausencia de votos', () => {
  assert.deepEqual(duelPercentages(0, 0), [0, 0]);
  assert.deepEqual(duelPercentages(1, 1), [50, 50]);
  assert.deepEqual(duelPercentages(1, 2), [33, 67]);
  assert.deepEqual(duelPercentages(3, 0), [100, 0]);
});
test('convocatorias: límites de plataforma, estilo y texto; ignora identidad/expiración externas', () => {
  assert.deepEqual(partyInput({ ...input, user_id: 'otro', expires_at: '2099-01-01' }), input);
  assert.equal(
    partyInput({ ...input, schedule: 'x'.repeat(100), contact_note: 'x'.repeat(500) }).contact_note
      .length,
    500,
  );
  for (const bad of [
    { platform: 'PS5' },
    { playstyle: 'bad' },
    { game_id: 'bad' },
    { schedule: 'ab' },
    { schedule: 'x'.repeat(101) },
    { contact_note: 'x'.repeat(501) },
  ])
    assert.throws(() => partyInput({ ...input, ...bad }));
});
test('habitación y expiración: opciones cerradas y frontera de 48 horas', () => {
  assert.equal(roomTheme('retro_shelf'), 'retro_shelf');
  assert.throws(() => roomTheme('evil'));
  const now = Date.parse('2026-10-07T00:00:00Z');
  assert.equal(remainingPartyTime('2026-10-07T00:00:00Z', now), 'Expirada');
  assert.equal(remainingPartyTime('2026-10-07T00:30:00Z', now), 'Expira en 30 min');
  assert.equal(remainingPartyTime('2026-10-09T00:00:00Z', now), 'Expira en 48 h');
});
