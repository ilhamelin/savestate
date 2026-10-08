import test from 'node:test';
import assert from 'node:assert/strict';
import { ownedPlatforms, hardwareForDisplay, MAX_HARDWARE } from '../../src/domain/hardware.ts';
import { profileDossier, type DossierEntry, type DossierLog } from '../../src/domain/dossier.ts';
test('Hardware validates bounds, duplicates, unsafe controls and stored display values', () => {
  assert.deepEqual(ownedPlatforms([' PC ', 'pc', 'Sega Dreamcast']), ['PC', 'Sega Dreamcast']);
  for (const value of [
    null,
    'PC',
    [null],
    [''],
    ['x'.repeat(49)],
    ['P\nC'],
    Array.from({ length: MAX_HARDWARE + 1 }, (_, i) => String(i)),
  ])
    assert.throws(() => ownedPlatforms(value));
  assert.deepEqual(hardwareForDisplay(null), []);
  assert.deepEqual(hardwareForDisplay([null, 'PS2', 'ps2', ' GBA\u0000 ']), ['PS2', 'GBA']);
});
test('Dossier excludes untouched backlog and wishlist from clear rate, includes platinum and started backlog', () => {
  const entries = [
    'cleared',
    'platinum',
    'playing',
    'dropped',
    'backlog',
    'backlog',
    'wishlist',
  ].map((status, index) => ({ id: String(index), status })) as DossierEntry[];
  const logs = [
    {
      user_game_id: '0',
      hours_played: 10,
      platform_played: 'PS2',
      play_method: 'hardware',
      start_date: null,
      finish_date: null,
    },
    {
      user_game_id: '0',
      hours_played: 5,
      platform_played: 'PS2',
      play_method: 'emulator',
      start_date: null,
      finish_date: null,
    },
    {
      user_game_id: '1',
      hours_played: 20,
      platform_played: 'GBA',
      play_method: 'emulator',
      start_date: null,
      finish_date: null,
    },
    {
      user_game_id: '4',
      hours_played: 0,
      platform_played: 'PC',
      play_method: 'other',
      start_date: '2026-01-01',
      finish_date: null,
    },
    {
      user_game_id: 'unrelated',
      hours_played: 999,
      platform_played: 'PC',
      play_method: 'hardware',
      start_date: null,
      finish_date: null,
    },
  ] as DossierLog[];
  const stats = profileDossier(entries, logs);
  assert.equal(stats.clearRate, 40);
  assert.equal(stats.started, 5);
  assert.equal(stats.completed, 2);
  assert.equal(stats.hours, 35);
  assert.equal(stats.averageCompletedHours, 17.5);
  assert.equal(stats.methods.find((m) => m.method === 'hardware')?.percent, 25);
  assert.equal(stats.methods.find((m) => m.method === 'emulator')?.percent, 50);
  assert.equal(stats.methods.find((m) => m.method === 'other')?.percent, 25);
  assert.equal(stats.platforms[0]?.name, 'GBA');
  assert.equal(
    stats.states.reduce((sum, row) => sum + row.count, 0),
    7,
  );
  assert.deepEqual(profileDossier([], []).hours, 0);
  assert.equal(profileDossier([], []).clearRate, 0);
  assert.equal(
    profileDossier(
      entries.filter((e) => e.status === 'backlog'),
      [],
    ).clearRate,
    0,
  );
});
