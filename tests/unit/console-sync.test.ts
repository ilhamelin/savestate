import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exactPsnAccount,
  exactXboxAccount,
  psnTitleRows,
  xboxTitleRows,
} from '../../src/domain/console-sync.ts';
test('console sync: exact identities only, including Xbox suffixes and numeric IDs', () => {
  const psn = {
    domainResponses: [
      {
        results: [
          { socialMetadata: { onlineId: 'Other', accountId: '1' } },
          { socialMetadata: { onlineId: 'MyPlayer', accountId: '2' } },
        ],
      },
    ],
  };
  assert.equal(exactPsnAccount(psn, 'myplayer'), '2');
  assert.equal(exactPsnAccount(psn, 'Missing'), null);
  const xbox = {
    people: [
      { gamertag: 'Other', xuid: '1' },
      {
        modernGamertag: 'Player',
        modernGamertagSuffix: '1234',
        uniqueModernGamertag: 'Player#1234',
        xuid: '2',
      },
    ],
  };
  assert.equal(exactXboxAccount(xbox, 'Player'), null);
  assert.equal(exactXboxAccount(xbox, 'player#1234'), '2');
  assert.equal(
    exactXboxAccount({ people: [{ gamertag: 'Player', xuid: '../secret' }] }, 'Player'),
    null,
  );
  assert.throws(() => exactXboxAccount({ profileUsers: [] }, 'Player'));
});
test('console sync: trophies map real platforms, completion and hidden titles', () => {
  const rows = psnTitleRows([
    {
      trophyTitleName: 'Finished',
      trophyTitlePlatform: 'PS4,PSVITA',
      progress: 60,
      earnedTrophies: { platinum: 1 },
    },
    { trophyTitleName: 'Started', trophyTitlePlatform: 'PS5', progress: 20 },
    { trophyTitleName: 'Hidden', trophyTitlePlatform: 'PS5', hiddenFlag: true },
    { trophyTitleName: 'Unknown', trophyTitlePlatform: 'unknown' },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.status, 'cleared');
  assert.equal(rows[0]!.platform, 'PlayStation 4');
  assert.equal(rows[1]!.status, 'playing');
  assert.ok(rows.every((row) => row.hours === 0));
});
test('console sync: achievement totals must be positive; PC-only games are not Xbox consoles', () => {
  const rows = xboxTitleRows([
    {
      name: 'Full',
      devices: ['XboxOne'],
      achievement: { currentGamerscore: 1000, totalGamerscore: 1000 },
    },
    {
      name: 'Zero',
      devices: ['XboxSeries'],
      achievement: { currentGamerscore: 0, totalGamerscore: 0 },
    },
    { name: 'Desktop', devices: ['Win32'] },
    { name: 'Full', devices: ['XboxOne'], maxGamerscore: 1000, currentGamerscore: 1000 },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.status, 'cleared');
  assert.equal(rows[1]!.status, 'playing');
  assert.throws(() => xboxTitleRows({}));
});
