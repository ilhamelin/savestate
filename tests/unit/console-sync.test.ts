import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exactPsnAccount,
  exactXboxAccount,
  psnTitleRows,
  xboxTitleRows,
  parseIsoDuration,
  psnPlaytimes,
} from '../../src/domain/console-sync.ts';

test('PSN durations parse hours, minutes and seconds with safe invalid fallbacks', () => {
  assert.equal(parseIsoDuration('PT72H23M32S'), 72.39);
  assert.equal(parseIsoDuration('PT2H25M'), 2.42);
  assert.equal(parseIsoDuration('PT45M'), 0.75);
  assert.equal(parseIsoDuration('PT10S'), 0);
  assert.equal(parseIsoDuration('PT36S'), 0.01);
  assert.equal(parseIsoDuration('PT137H6M36S'), 137.11);
  assert.equal(parseIsoDuration('PT0H0M0S'), 0);
  for (const value of [
    null,
    undefined,
    72,
    {},
    '',
    'PT',
    'P1D',
    'PT-1H',
    'PT1.5H',
    'PT1M2H',
    ' PT2H',
    'PT2Hgarbage',
    `PT${'9'.repeat(101)}H`,
  ])
    assert.equal(parseIsoDuration(value), 0);
});
test('PSN playtime joins normalized trophy titles, excludes media and preserves missing retro hours', () => {
  const playtimes = psnPlaytimes([
    { name: ' Roblox ', playDuration: 'PT72H23M32S', category: 'ps5_native_game' },
    { name: 'Roblox', playDuration: 'PT1H', category: 'ps4_game' },
    { name: 'Netflix', playDuration: 'PT99H', category: 'ps5_media_app' },
    { name: 'Huge', playDuration: 'PT100001H', category: 'ps5_native_game' },
  ]);
  assert.equal(playtimes.get('roblox'), 72.39);
  assert.equal(playtimes.has('netflix'), false);
  assert.equal(playtimes.has('huge'), false);
  const rows = psnTitleRows(
    [
      { trophyTitleName: 'ROBLOX', trophyTitlePlatform: 'PS5', progress: 100 },
      { trophyTitleName: 'Retro', trophyTitlePlatform: 'PS3' },
    ],
    playtimes,
  );
  assert.equal(rows[0]!.hours, 72.39);
  assert.equal(rows[0]!.status, 'cleared');
  assert.equal(rows[1]!.hours, 0);
  assert.equal(
    psnTitleRows([{ trophyTitleName: 'ROBLOX', trophyTitlePlatform: 'PS5' }])[0]!.hours,
    0,
  );
});
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
  assert.equal(exactXboxAccount({ profileUsers: [] }, 'Player'), null);
  const profile = { id: '2535436457611225', settings: [{ id: 'Gamertag', value: 'ilhamelin' }] };
  assert.equal(exactXboxAccount({ content: { profileUsers: [profile] } }, 'ILHAMELIN'), profile.id);
  assert.equal(exactXboxAccount({ profileUsers: [profile] }, 'Other'), null);
  assert.equal(
    exactXboxAccount({ profileUsers: [{ ...profile, id: '../bad' }] }, 'ilhamelin'),
    null,
  );
  assert.throws(() => exactXboxAccount({}, 'Player'));
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
test('console sync: positive achievement totals and PC ecosystem fallback', () => {
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
    { name: 'PC ecosystem', devices: ['PC'] },
    { name: 'Full', devices: ['XboxOne'], maxGamerscore: 1000, currentGamerscore: 1000 },
  ]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0]!.status, 'cleared');
  assert.equal(rows[1]!.status, 'playing');
  assert.equal(rows[2]!.platform, 'Xbox One');
  assert.throws(() => xboxTitleRows({}));
});
