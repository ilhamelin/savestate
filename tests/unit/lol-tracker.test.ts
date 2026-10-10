import test from 'node:test';
import assert from 'node:assert/strict';
import {
  riotId,
  lolPlatform,
  accountCluster,
  LOL_PLATFORMS,
  dataDragonVersion,
  lolAssetUrl,
  dataDragonAssets,
  normalizeLolRank,
  normalizeLolMatch,
} from '../../src/domain/lol-tracker.ts';

const assets = dataDragonAssets(
  '16.20.1',
  {
    data: { Fiddlesticks: { key: '9', name: 'Fiddlesticks', image: { full: 'Fiddlesticks.png' } } },
  },
  { data: { SummonerFlash: { key: '4', name: 'Destello', image: { full: 'SummonerFlash.png' } } } },
);
const participant = (puuid = 'target', teamId = 100) => ({
  puuid,
  teamId,
  riotIdGameName: 'Jugador',
  riotIdTagline: 'LAS',
  championId: 9,
  championName: 'FiddleSticks',
  champLevel: 18,
  kills: 10,
  deaths: 2,
  assists: 6,
  totalMinionsKilled: 180,
  neutralMinionsKilled: 20,
  item0: 1001,
  item1: 0,
  item2: 0,
  item3: 0,
  item4: 0,
  item5: 0,
  item6: 3340,
  summoner1Id: 4,
  summoner2Id: 999,
  totalDamageDealtToChampions: 22000,
  goldEarned: 14500,
  win: teamId === 100,
  teamPosition: 'JUNGLE',
});
const match = () => ({
  metadata: { matchId: 'LA2_123' },
  info: {
    queueId: 420,
    gameMode: 'CLASSIC',
    gameType: 'MATCHED_GAME',
    gameVersion: '16.20.1000',
    gameDuration: 1200,
    gameEndTimestamp: 1791637200000,
    participants: [participant(), participant('enemy', 200)],
  },
});
test('Rift validates Unicode Riot IDs and separates platform, match and account routing', () => {
  assert.deepEqual(riotId(' Faker#KR1 '), { gameName: 'Faker', tagLine: 'KR1' });
  assert.deepEqual(riotId('Jugador Ñ#LAS'), { gameName: 'Jugador Ñ', tagLine: 'LAS' });
  for (const value of [
    '',
    null,
    {},
    'Faker',
    'Faker#KR1#NA1',
    'a#LAS',
    'Faker#x',
    'Faker#../',
    'Jugador\n#LAS',
  ])
    assert.throws(() => riotId(value));
  for (const value of ['https://evil.test', '__proto__', 'constructor', null])
    assert.throws(() => lolPlatform(value));
  assert.equal(lolPlatform(' LA2 '), 'la2');
  assert.equal(LOL_PLATFORMS.la2.cluster, 'americas');
  assert.equal(LOL_PLATFORMS.kr.cluster, 'asia');
  assert.equal(LOL_PLATFORMS.euw1.cluster, 'europe');
  assert.equal(LOL_PLATFORMS.oc1.cluster, 'sea');
  assert.equal(accountCluster('oc1'), 'asia');
});
test('Rift assets match the game patch, use canonical champion/spell filenames and reject URL traversal', () => {
  assert.equal(dataDragonVersion(['16.20.1', '16.19.1'], '16.19.1234'), '16.19.1');
  assert.equal(dataDragonVersion(['16.20.1'], '16.19.1234'), '16.20.1');
  assert.throws(() => dataDragonVersion(['evil']));
  assert.equal(lolAssetUrl('16.20.1', 'champion', '../evil.png'), null);
  assert.equal(lolAssetUrl('bad', 'item', '1001.png'), null);
  const result = normalizeLolMatch(match(), 'target', assets)!;
  assert.equal(result.player.championName, 'Fiddlesticks');
  assert.match(result.player.championIcon!, /\/Fiddlesticks.png$/);
  assert.match(result.player.spells[0]!, /\/SummonerFlash.png$/);
  assert.equal(result.player.spells[1], null);
  assert.equal(result.player.items.length, 6);
  assert.equal(result.player.items[1], null);
  assert.match(result.player.trinket!, /\/3340.png$/);
});
test('Rift statistics include neutral CS, damage, gold, finite KDA and actual team members', () => {
  const result = normalizeLolMatch(match(), 'target', assets)!;
  assert.equal(result.player.cs, 200);
  assert.equal(result.player.csPerMin, 10);
  assert.equal(result.player.kda, '8.00');
  assert.equal(result.player.championLevel, 18);
  assert.equal(result.player.totalDamage, 22000);
  assert.equal(result.player.gold, 14500);
  assert.equal(result.player.win, true);
  assert.equal(result.gameMode, 'Solo/Dúo');
  assert.equal(result.team100.length, 1);
  assert.equal(result.team200.length, 1);
  const raw = match();
  raw.info.participants[0]!.deaths = 0;
  assert.equal(normalizeLolMatch(raw, 'target', assets)!.player.kda, 'Perfecto');
  raw.info.gameVersion = '11.19.1';
  raw.info.gameDuration = 1200000;
  assert.equal(normalizeLolMatch(raw, 'target', assets)!.gameDurationMinutes, 20);
  raw.info.gameDuration = 0;
  assert.throws(() => normalizeLolMatch(raw, 'target', assets));
  assert.throws(() => normalizeLolMatch(match(), 'missing', assets));
  const custom = match();
  custom.info.gameType = 'CUSTOM_GAME';
  assert.equal(normalizeLolMatch(custom, 'target', assets), null);
});
test('Rift rank winrate handles zero games and rejects unsupported ranks', () => {
  assert.equal(
    normalizeLolRank({ tier: 'GOLD', rank: 'IV', leaguePoints: 25, wins: 6, losses: 4 }).winrate,
    60,
  );
  assert.equal(
    normalizeLolRank({ tier: 'IRON', rank: 'IV', leaguePoints: 0, wins: 0, losses: 0 }).winrate,
    0,
  );
  assert.throws(() => normalizeLolRank({ tier: 'invented', rank: 'IV' }));
});
