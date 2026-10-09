import test from 'node:test';
import assert from 'node:assert/strict';
import {
  consoleHours,
  consoleIdentity,
  consolePlatform,
  consoleSource,
  parseConsoleImport,
} from '../../src/domain/console-import.ts';

test('console import: CSV quoted titles, decimal comma and BOM', () => {
  const rows = parseConsoleImport(
    '\uFEFFtitle;platform;hours;status\r\n"Ratchet, Clank";PS5;"12,50";completed\r\n"Game ""Deluxe""";PS4;0;abandoned',
    'csv',
    'PlayStation',
    'PS5',
  );
  assert.deepEqual(rows, [
    { title: 'Ratchet, Clank', platform: 'PlayStation 5', hours: 12.5, status: 'cleared' },
    { title: 'Game "Deluxe"', platform: 'PlayStation 4', hours: 0, status: 'dropped' },
  ]);
});
test('console import: JSON aliases, minutes, explicit states and plain lists', () => {
  const rows = parseConsoleImport(
    JSON.stringify({
      games: [
        { name: 'Halo', minutes: 90 },
        { titulo: 'Fable', horas: 0, status: 'platinum' },
      ],
    }),
    'json',
    'Xbox',
    'Xbox One',
  );
  assert.equal(rows[0]!.hours, 1.5);
  assert.equal(rows[0]!.status, 'playing');
  assert.equal(rows[1]!.status, 'platinum');
  assert.equal(parseConsoleImport('Halo\nHalo\nFable', 'text', 'Xbox', 'Xbox').length, 2);
  assert.equal(parseConsoleImport('龍が如く\n大神', 'text', 'PlayStation', 'PS2').length, 2);
});
test('console import: malformed exports and bounds fail before persistence', () => {
  for (const [raw, format] of [
    ['title,hours\n"unclosed,3', 'csv'],
    ['title,hours\nHalo,2,3', 'csv'],
    ['hours\n2', 'csv'],
    ['[]', 'json'],
    ['{', 'json'],
    [JSON.stringify([{ title: 'Halo', hours: -1 }]), 'json'],
    [JSON.stringify([{ title: 'Halo', platform: 'PS5' }]), 'json'],
    [JSON.stringify([{ title: 'Halo', status: 'fake' }]), 'json'],
  ] as const) {
    assert.throws(() => parseConsoleImport(raw, format, 'Xbox', 'Xbox One'));
  }
  assert.throws(() =>
    parseConsoleImport(
      Array.from({ length: 201 }, (_, i) => `Game ${i}`).join('\n'),
      'text',
      'Xbox',
      'Xbox',
    ),
  );
  assert.throws(() => parseConsoleImport('a'.repeat(200001), 'text', 'Xbox', 'Xbox'));
});
test('console import: sources, identifiers, platform membership and finite hours', () => {
  assert.equal(consoleIdentity(' gamer#1234 '), 'gamer#1234');
  assert.equal(consoleIdentity(''), null);
  for (const value of ['aa', 'x'.repeat(31), 'bad\nuser', '<script>'])
    assert.throws(() => consoleIdentity(value));
  assert.equal(consolePlatform('Xbox Series S', 'Xbox'), 'Xbox Series X|S');
  assert.throws(() => consolePlatform('PS5', 'Xbox'));
  assert.throws(() => consoleSource('Steam'));
  for (const value of [NaN, Infinity, -1, 100001, '2 hours', null])
    assert.throws(() => consoleHours(value));
  assert.equal(consoleHours('12,25'), 12.25);
});
