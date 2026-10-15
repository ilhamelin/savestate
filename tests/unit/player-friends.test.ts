import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLastActivity } from '../../src/domain/player-friends.ts';

const now = Date.parse('2026-10-15T15:00:00Z');
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();
test('Friend last activity handles missing, invalid and future timestamps safely', () => {
  for (const timestamp of [null, undefined, '', 'invalid'])
    assert.equal(formatLastActivity(timestamp, now), 'Inactivo');
  assert.equal(formatLastActivity(ago(-60), now), 'Inactivo · hace unos segundos');
  assert.equal(formatLastActivity(ago(0), NaN), 'Inactivo');
});
test('Friend last activity formats seconds, minutes and hours at exact boundaries', () => {
  for (const [seconds, label] of [
    [0, 'hace unos segundos'],
    [59, 'hace unos segundos'],
    [60, 'hace 1 min'],
    [3599, 'hace 59 min'],
    [3600, 'hace 1 h'],
    [86399, 'hace 23 h'],
  ] as const)
    assert.equal(formatLastActivity(ago(seconds), now), `Inactivo · ${label}`);
});
test('Friend last activity formats days, weeks, months and older activity', () => {
  for (const [days, label] of [
    [1, 'hace 1 d'],
    [6, 'hace 6 d'],
    [7, 'hace 1 sem'],
    [34, 'hace 4 sem'],
    [35, 'hace 1 m'],
    [60, 'hace 2 m'],
    [330, 'hace 11 m'],
    [400, 'hace más de 1 año'],
  ] as const)
    assert.equal(formatLastActivity(ago(days * 86400), now), `Inactivo · ${label}`);
});
