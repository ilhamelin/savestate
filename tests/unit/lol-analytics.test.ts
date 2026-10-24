import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterLolMatches,
  lolAnalytics,
  lolMatchMedals,
  lolMomentLink,
} from '../../src/domain/lol-analytics.ts';
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
      largestMultiKill: 0,
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
  const rows = [420, 400, 430, 450, 440, 1700, 1710, 1750, 900, 490].map((id) =>
    match(id, 'Ahri', 'MIDDLE', true),
  );
  assert.equal(filterLolMatches(rows, 'all').length, 10);
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
    [440, 900, 490],
  );
  assert.deepEqual(
    filterLolMatches(rows, 'arena').map((m) => m.queueId),
    [1700, 1710, 1750],
  );
  assert.equal(rows.length, 10);
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

test('Rift medals compare only teammates, allow tied MVP and handle zero team kills', () => {
  const row = match(420, 'Rammus', 'JUNGLE', true, 5, 2, 22);
  row.player.largestMultiKill = 5;
  const ally = {
    ...row.player,
    puuid: 'ally',
    kills: 35,
    assists: 0,
    deaths: 5,
    totalDamage: 30000,
  };
  row.participants = [row.player, ally, { ...ally, teamId: 200, kills: 100, totalDamage: 90000 }];
  assert.deepEqual(lolMatchMedals(row), {
    multikill: 'PENTAKILL',
    mvp: true,
    killParticipation: 68,
  });
  row.player.largestMultiKill = 4;
  assert.equal(lolMatchMedals(row).multikill, 'CUATRICIDIO');
  row.player.assists = 0;
  assert.equal(lolMatchMedals(row).mvp, false);
  row.player.totalDamage = ally.totalDamage;
  assert.equal(lolMatchMedals(row).mvp, true);
  const zero = match(450, 'Ahri', '', false, 0, 0, 0);
  zero.player.totalDamage = 0;
  zero.participants = [zero.player, { ...zero.player, puuid: 'ally' }];
  assert.deepEqual(lolMatchMedals(zero), { multikill: null, mvp: false, killParticipation: 0 });
  const link = new URL(lolMomentLink(row), 'https://savestate.test');
  assert.equal(link.pathname, '/tavern');
  assert.equal(link.searchParams.get('tab'), 'momentos');
  assert.ok(link.searchParams.get('draft')?.includes('Rammus'));
  assert.ok(link.searchParams.get('draftTitle')!.length <= 120);
});

test('Rift highlights preserve rich Markdown statistics and only earned medals', () => {
  const row = match(420, 'Rammus', 'JUNGLE', true, 5, 2, 22);
  row.gameMode = 'Solo/Dúo';
  row.player.kda = '13.5';
  row.player.largestMultiKill = 5;
  row.participants = [
    row.player,
    { ...row.player, puuid: 'ally', kills: 35, deaths: 5, assists: 0, totalDamage: 30000 },
  ];
  const params = new URL(lolMomentLink(row), 'https://savestate.test').searchParams;
  assert.equal(
    params.get('draftTitle'),
    '🎮 League of Legends: ¡Partidaza con Rammus en Solo/Dúo!',
  );
  const draft = params.get('draft')!;
  for (const text of [
    '**Juego:** League of Legends',
    '**Modo:** Solo/Dúo',
    '**Campeón:** Rammus (Nivel 18)',
    '**Resultado:** Victoria 🟢',
    '**KDA:** 5/2/22 (13.5 KDA)',
    '**Daño a campeones:** 20.000',
    '**Oro acumulado:** 15.000',
    '**Súbditos (CS):** 200 (6.67/min)',
    '**Participación en bajas:** 68% P/K',
    '**Hazaña:** ⚡ PENTAKILL',
    '**Distintivo:** 👑 MVP del equipo',
    '[Rift Tracker](/rift)',
  ])
    assert.ok(draft.includes(text), text);
  assert.ok(draft.includes('\n\n'));
  row.player.win = false;
  row.player.largestMultiKill = 0;
  row.participants = [row.player];
  const defeat = new URL(lolMomentLink(row), 'https://savestate.test').searchParams.get('draft')!;
  assert.ok(defeat.includes('Derrota 🔴'));
  assert.equal(defeat.includes('**Hazaña:**'), false);
  assert.equal(defeat.includes('**Distintivo:**'), false);
  row.player.championName = 'A'.repeat(200);
  assert.equal(
    new URL(lolMomentLink(row), 'https://savestate.test').searchParams.get('draftTitle')!.length,
    120,
  );
});
