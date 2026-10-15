import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFreebies,
  matchesPlatformFilter,
  formatFreebieTimeRemaining,
} from '../../src/domain/freebies.ts';

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

test('Freebie categories match case-insensitively across stores and console families', () => {
  for (const platforms of [
    'PC, Steam',
    'PC, Epic Games Store',
    'GOG, DRM-Free',
    'PlayStation 5',
    'Xbox Series X',
    'Nintendo Switch',
    'Other',
  ])
    assert.equal(matchesPlatformFilter(platforms, 'all'), true);
  assert.equal(matchesPlatformFilter('PC, STEAM', 'steam'), true);
  assert.equal(matchesPlatformFilter('Epic Games Store', 'epic'), true);
  assert.equal(matchesPlatformFilter('GOG', 'gog'), true);
  for (const platform of ['PlayStation 5', 'XBOX', 'Nintendo Switch'])
    assert.equal(matchesPlatformFilter(platform, 'consoles'), true);
  for (const platform of ['PC', 'DRM-Free'])
    assert.equal(matchesPlatformFilter(platform, 'pc'), true);
  assert.equal(matchesPlatformFilter('Steam', 'epic'), false);
  assert.equal(matchesPlatformFilter('PC, Steam', 'consoles'), false);
  assert.equal(matchesPlatformFilter('', 'gog'), false);
});

test('Freebie countdowns use UTC and preserve urgency at minute, hour and day boundaries', () => {
  const now = Date.parse('2026-10-15T00:00:00Z');
  for (const [date, label, isUrgent] of [
    ['2026-10-15 00:00:01', 'Últimos 1m', true],
    ['2026-10-15 00:59:00', 'Últimos 59m', true],
    ['2026-10-15 01:00:00', 'Quedan 1h', true],
    ['2026-10-15 23:59:59', 'Quedan 23h', true],
    ['2026-10-16 00:00:00', 'Queda 1 día', false],
    ['2026-10-17 00:00:00', 'Quedan 2 días', false],
  ] as const)
    assert.deepEqual(formatFreebieTimeRemaining(date, now), { label, isUrgent });
  assert.deepEqual(formatFreebieTimeRemaining('2026-10-16T00:00:00Z', now), {
    label: 'Queda 1 día',
    isUrgent: false,
  });
  assert.deepEqual(formatFreebieTimeRemaining('2026-10-15T22:00:00-02:00', now), {
    label: 'Queda 1 día',
    isUrgent: false,
  });
  for (const date of [
    null,
    '',
    'N/A',
    'invalid',
    '2026-13-01 00:00:00',
    '2026-10-15 00:00:00',
    '2026-10-14 23:59:59',
  ])
    assert.equal(formatFreebieTimeRemaining(date, now), null);
  assert.equal(formatFreebieTimeRemaining('2026-10-16 00:00:00', NaN), null);
});

test('Freebie normalization retains the default eight and supports bounded explicit limits', () => {
  const input = Array.from({ length: 30 }, (_, i) => game(i + 1));
  assert.equal(normalizeFreebies(input).length, 8);
  assert.equal(normalizeFreebies(input, 24).length, 24);
  assert.equal(normalizeFreebies(input, 3).length, 3);
  for (const limit of [0, -1, NaN, Infinity, 1.5])
    assert.deepEqual(normalizeFreebies(input, limit), []);
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
