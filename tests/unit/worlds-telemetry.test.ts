import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasWorldsTelemetryMetrics,
  mergeWorldsTelemetry,
  readSavedWorldsTelemetry,
} from '../../src/domain/worlds-telemetry.ts';
import type { WorldsGameTelemetry } from '../../src/domain/worlds-schedule.ts';

function telemetry(gameNumber = 1): WorldsGameTelemetry {
  return {
    gameId: String(100 + gameNumber),
    gameNumber,
    gameState: 'finished',
    patchVersion: '16.20',
    durationSeconds: 2000,
    blueTeam: {
      totalGold: 50000,
      totalKills: 20,
      towers: 8,
      barons: 1,
      inhibitors: 2,
      dragons: ['infernal'],
    },
    redTeam: { totalGold: 40000, totalKills: 10, towers: 2, barons: 0, inhibitors: 0, dragons: [] },
    bluePlayers: [
      {
        participantId: 1,
        summonerName: 'Player',
        championId: 'Ahri',
        championIconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.20.1/img/champion/Ahri.png',
        role: 'mid',
        level: 18,
        kills: 10,
        deaths: 2,
        assists: 10,
        kdaRatio: 10,
        killParticipationPct: 100,
        creepScore: 250,
        totalGold: 16000,
        goldSharePct: 32,
        isMvp: true,
      },
    ],
    redPlayers: [],
  };
}
test('Worlds telemetry: browser JSON round-trip preserves multiple maps and rejects corrupt storage', () => {
  const first = telemetry(),
    second = telemetry(2);
  assert.deepEqual(readSavedWorldsTelemetry(JSON.stringify({ 1: first, 2: second })), {
    1: first,
    2: second,
  });
  for (const raw of [
    null,
    '',
    '{broken',
    'null',
    '[]',
    JSON.stringify({ 1: { gameId: '101' } }),
    'x'.repeat(500001),
  ])
    assert.deepEqual(readSavedWorldsTelemetry(raw), {});
  for (const invalid of [
    { ...first, blueTeam: null },
    { ...first, bluePlayers: [{}] },
    { ...first, durationSeconds: -1 },
    { ...first, gameNumber: 2 },
    { ...first, gameId: '../other' },
    { ...first, redTeam: { ...first.redTeam, dragons: [null] } },
  ])
    assert.deepEqual(readSavedWorldsTelemetry(JSON.stringify({ 1: invalid })), {});
});
test('Worlds telemetry: merges preserve finished maps through nulls, regressions and empty metrics', () => {
  const first = telemetry(),
    second = telemetry(2),
    previous = { 1: first };
  assert.deepEqual(mergeWorldsTelemetry(previous, { 2: second }), { 1: first, 2: second });
  assert.deepEqual(mergeWorldsTelemetry(previous, {}), previous);
  assert.equal(mergeWorldsTelemetry(previous, { 1: { ...first, gameState: 'in_game' } })[1], first);
  const empty = {
    ...first,
    durationSeconds: 0,
    blueTeam: { ...first.blueTeam, totalGold: 0 },
    redTeam: { ...first.redTeam, totalGold: 0 },
  };
  assert.equal(mergeWorldsTelemetry(previous, { 1: empty })[1], first);
  const updated = { ...first, durationSeconds: 2100 };
  assert.equal(mergeWorldsTelemetry(previous, { 1: updated })[1], updated);
  const replacement = { ...first, gameId: '999', gameState: 'in_game' as const };
  assert.equal(mergeWorldsTelemetry(previous, { 1: replacement })[1], replacement);
  assert.deepEqual(previous, { 1: first });
});
test('Worlds telemetry: saves partial metrics or finished maps but excludes empty live maps', () => {
  const first = telemetry();
  const empty = {
    ...first,
    gameState: 'in_game' as const,
    durationSeconds: 0,
    blueTeam: { ...first.blueTeam, totalGold: 0 },
    redTeam: { ...first.redTeam, totalGold: 0 },
  };
  assert.equal(hasWorldsTelemetryMetrics(empty), false);
  assert.deepEqual(readSavedWorldsTelemetry(JSON.stringify({ 1: empty })), {});
  for (const value of [
    first,
    { ...empty, durationSeconds: 30 },
    { ...empty, redTeam: { ...empty.redTeam, totalGold: 500 } },
  ]) {
    assert.equal(hasWorldsTelemetryMetrics(value), true);
    assert.deepEqual(readSavedWorldsTelemetry(JSON.stringify({ 1: value })), { 1: value });
  }
  assert.deepEqual(
    readSavedWorldsTelemetry(JSON.stringify({ 1: { ...empty, gameState: 'finished' } })),
    { 1: { ...empty, gameState: 'finished' } },
  );
});
