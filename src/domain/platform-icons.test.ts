import test from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORM_ICON_PATHS, resolvePlatformIcon } from './platform-icons.ts';

test('resolves PlayStation aliases and generations case-insensitively', () => {
  for (const label of [
    'PlayStation',
    'PLAYSTATION 5',
    'PSN',
    'ps1',
    'PS2',
    'PS3',
    'PS4',
    'PS5',
    'PS Vita',
    'PSV',
    '  ps vita  ',
  ]) {
    assert.equal(resolvePlatformIcon(label), PLATFORM_ICON_PATHS.playstation, label);
  }
});

test('resolves Xbox and Steam hardware and account labels', () => {
  for (const label of ['Xbox', 'XBOX Series X|S', 'Xbox360', 'Xbox Live']) {
    assert.equal(resolvePlatformIcon(label), PLATFORM_ICON_PATHS.xbox, label);
  }
  for (const label of ['Steam', 'STEAM', 'PC / Steam', 'Steam Deck / Portátil PC']) {
    assert.equal(resolvePlatformIcon(label), PLATFORM_ICON_PATHS.steam, label);
  }
});

test('returns null for unsupported hardware and unrelated text', () => {
  for (const label of ['', 'PC', 'Nintendo Switch', 'PS6', 'GPS5', 'ps10', 'epsilon', 'Discord']) {
    assert.equal(resolvePlatformIcon(label), null, label);
  }
});
