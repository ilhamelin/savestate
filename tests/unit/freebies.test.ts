import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFreebies } from '../../src/domain/freebies.ts';

const game = (id = 1) => ({
  id,
  title: 'Juego gratis',
  type: 'Game',
  status: 'Active',
  worth: '$9.99',
  thumbnail: 'https://www.gamerpower.com/offers/1/game.jpg',
  open_giveaway_url: 'https://www.gamerpower.com/open/game',
  platforms: 'PC, Steam',
  end_date: '2026-10-12 23:59:00',
});
test('Freebies preserves real values, caps active games and excludes duplicates and loot', () => {
  const rows = normalizeFreebies([
    game(),
    game(),
    { ...game(2), type: 'Loot' },
    { ...game(3), status: 'Expired' },
    ...Array.from({ length: 10 }, (_, i) => game(i + 4)),
  ]);
  assert.equal(rows.length, 8);
  assert.equal(rows[0]?.worth, '$9.99');
  assert.equal(rows[0]?.platforms, 'PC, Steam');
  assert.equal(rows[0]?.endDate, '2026-10-12 23:59:00');
  assert.equal(new Set(rows.map((row) => row.id)).size, 8);
  assert.equal(
    rows.some((row) => row.id === 2 || row.id === 3),
    false,
  );
});
test('Freebies rejects unsafe claims and does not fabricate missing prices, images or deadlines', () => {
  assert.deepEqual(normalizeFreebies({ status: 201 }), []);
  for (const url of [
    'javascript:alert(1)',
    'https://www.gamerpower.com.evil.example/open/game',
    'https://user:pass@www.gamerpower.com/open/game',
    'https://www.gamerpower.com/other',
  ])
    assert.deepEqual(normalizeFreebies([{ ...game(), open_giveaway_url: url }]), []);
  const row = normalizeFreebies([
    { ...game(), worth: 'N/A', end_date: 'N/A', thumbnail: 'https://unknown.example/game.jpg' },
  ])[0];
  assert.equal(row?.worth, 'no indicado');
  assert.equal(row?.endDate, null);
  assert.equal(row?.thumbnail, null);
});
