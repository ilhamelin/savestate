import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLolMatches, lolAnalytics } from '../../src/domain/lol-analytics.ts';
import type { LolMatchSummary } from '../../src/domain/lol-tracker.ts';

function match(
  queueId: number,
  championName: string,
  role: string,
  win: boolean,
  kills = 8,
  deaths = 2,
  assists = 4,
): LolMatchSummary {
  return {
    matchId: `${queueId}-${championName}`,
    queueId,
    gameMode: 'LoL',
    gameDurationMinutes: 30,
    gameEndTimestamp: 1,
    team100: [],
    team200: [],
    participants: [],
    player: {
      puuid: 'player',
      riotId: 'Player#LAS',
      teamId: 100,
      championName,
      championIcon: null,
      championLevel: 18,
      kills,
      deaths,
      assists,
      win,
      role,
      kda: '6',
      kdaRatio: 6,
      cs: 200,
      csPerMin: 6.67,
      items: [],
      itemIds: [],
      trinket: null,
      trinketId: 0,
      spells: [],
      spellNames: [],
      totalDamage: 20000,
      gold: 15000,
    },
  };
}
test('Rift queue filters cover exact queues and preserve input order', () => {
  const rows = [420, 400, 430, 450, 440, 1700, 900, 490].map((id) =>
    match(id, 'Ahri', 'MIDDLE', true),
  );
  assert.equal(filterLolMatches(rows, 'all').length, 8);
  assert.deepEqual(
    filterLolMatches(rows, 'solo').map((m) => m.queueId),
    [420],
  );
  assert.deepEqual(
    filterLolMatches(rows, 'normal').map((m) => m.queueId),
    [400, 430],
  );
  assert.deepEqual(
    filterLolMatches(rows, 'aram').map((m) => m.queueId),
    [450],
  );
  assert.deepEqual(
    filterLolMatches(rows, 'other').map((m) => m.queueId),
    [440, 1700, 900, 490],
  );
  assert.equal(rows.length, 8);
});
test('Rift analytics aggregate KDA from totals, averages and truthful roles', () => {
  const rows = [
    match(420, 'Ahri', 'MIDDLE', true, 10, 1, 8),
    match(420, 'Ahri', 'MIDDLE', false, 2, 5, 4),
    match(450, 'Lux', '', true, 4, 0, 10),
    match(420, 'Lux', 'SUPPORT', true, 2, 0, 6),
  ];
  const data = lolAnalytics(rows);
  const mid = data.roles.find((row) => row.id === 'MIDDLE')!;
  assert.equal(mid.games, 2);
  assert.equal(mid.winrate, 50);
  assert.equal(mid.wins, 1);
  assert.equal(mid.losses, 1);
  assert.equal(mid.kdaRatio, 4);
  assert.deepEqual([mid.kills, mid.deaths, mid.assists], [6, 3, 6]);
  assert.equal(data.roles.find((row) => row.id === 'UTILITY')?.perfect, true);
  assert.equal(
    data.roles.reduce((sum, row) => sum + row.games, 0),
    3,
  );
  assert.deepEqual(
    data.champions.map((row) => row.label),
    ['Ahri', 'Lux'],
  );
  assert.equal(data.champions[1]?.winrate, 100);
  assert.equal(data.champions[1]?.perfect, true);
  assert.equal(lolAnalytics(filterLolMatches(rows, 'aram')).champions[0]?.games, 1);
  assert.deepEqual(lolAnalytics([]), { roles: [], champions: [] });
});
test('Rift top champions use match count first and only show five', () => {
  const rows = ['Zed', 'Ahri', 'Bard', 'Corki', 'Diana', 'Ekko', 'Zed'].map((name) =>
    match(420, name, 'TOP', true),
  );
  assert.deepEqual(
    lolAnalytics(rows).champions.map((row) => row.label),
    ['Zed', 'Ahri', 'Bard', 'Corki', 'Diana'],
  );
});
