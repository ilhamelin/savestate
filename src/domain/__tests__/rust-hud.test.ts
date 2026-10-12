import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizedRust, buildBreakdown } from '../rust-profile.ts';
const id = '76561198395738643';
const summary = { response: { players: [{ steamid: id, personaname: 'HUD fixture' }] } };
function profile(stats: Record<string, number>) {
  return normalizedRust(
    summary,
    null,
    {
      playerstats: {
        steamID: id,
        stats: Object.entries(stats).map(([name, value]) => ({ name, value })),
      },
    },
    id,
  );
}
test('Rust advanced HUD separates PvE counters and derives bounded combat percentages', () => {
  const data = profile({
    kill_player: 5444,
    kill_scientist: 3000,
    kill_bear: 100,
    kill_boar: 200,
    kill_stag: 200,
    kill_wolf: 200,
    kill_chicken: 100,
    kill_horse: 200,
    kill_tunneldweller: 988,
    deaths: 10,
    headshot: 9355,
    bullet_hit_player: 25475,
    bullet_fired: 123447,
  });
  assert.equal(data.combat?.killsPvp, 456);
  assert.equal(data.combat?.totalKills, 5444);
  assert.equal(data.combat?.animalsKilled, 1000);
  assert.equal(data.combat?.kdRatio, 45.6);
  assert.equal(data.combat?.headshotRatePercent, 36.72);
  assert.equal(data.combat?.accuracyPercent, 20.64);
  assert.equal(data.breakdowns?.totalKills, data.combat?.totalKills);
  assert.equal(data.breakdowns?.kills.find((row) => row.id === 'dwellers')?.count, 988);
  const edge = profile({
    kill_player: 5,
    kill_bear: 10,
    headshot: 50,
    bullet_hit_player: 5,
    bullet_fired: 2,
  });
  assert.equal(edge.combat?.killsPvp, 5);
  assert.equal(edge.combat?.totalKills, 15);
  assert.equal(edge.combat?.accuracyPercent, 100);
  assert.equal(edge.combat?.headshotRatePercent, 100);
});
test('Rust breakdowns aggregate corpse aliases, resources and proportional segments', () => {
  const data = profile({
    bullet_hit_player: 10,
    bullet_hit_playercorpse: 3,
    bullet_hit_corpse: 2,
    bullet_hit_building: 5,
    'acquired_metal.ore': 10.4,
    acquired_scrap: 20.6,
    acquired_lowgradefuel: 30,
    harvested_wood: 100,
    harvested_stones: 40,
    'acquired_sulfur.ore': 5,
    harvested_cloth: 6,
    harvested_leather: 7,
  });
  assert.equal(data.breakdowns?.totalBulletHits, 20);
  assert.equal(data.breakdowns?.bulletHits.find((row) => row.id === 'corpses')?.count, 5);
  assert.equal(data.breakdowns?.bulletHits.find((row) => row.id === 'players')?.percent, 50);
  assert.equal(data.breakdowns?.totalResources, 219);
  assert.equal(data.breakdowns?.resources.find((row) => row.id === 'scrap')?.count, 21);
  assert.ok(
    Math.abs(data.breakdowns!.resources.reduce((sum, row) => sum + row.percent, 0) - 100) <= 0.05,
  );
  assert.deepEqual(buildBreakdown([['zero', 'Zero', '0', 0, '#000']]), {
    total: 0,
    items: [{ id: 'zero', label: 'Zero', icon: '0', count: 0, color: '#000', percent: 0 }],
  });
});
test('Rust tactical modules respect kilometer precedence, conversion, rounding and meter fallback', () => {
  const data = profile({
    placed_blocks: 12.6,
    upgraded_blocks: 4,
    blueprint_studied: 6,
    horse_distance_ridden_km: 10.4,
    horse_distance_ridden: 50000,
    wounded_healed: 8,
    melee_strikes: 1000,
    melee_throws: 12,
    rockets_fired: 3,
    calories_consumed: 555,
    water_consumed: 222,
    wounded: 9,
  });
  assert.deepEqual(data.modules, {
    building: { blocksPlaced: 13, blocksUpgraded: 4, blueprintsStudied: 6 },
    horse: { kilometersRidden: 10, milesRidden: 6.21, woundedHealed: 8 },
    melee: { strikes: 1000, throws: 12, rocketsFired: 3 },
    consumption: { calories: 555, water: 222, woundedTimes: 9 },
  });
  assert.equal(profile({ horse_distance_ridden: 12500 }).modules?.horse.kilometersRidden, 13);
});
test('Rust HUD preserves private data as unavailable and safely renders true empty counters', () => {
  const privateData = normalizedRust(summary, null, null, id);
  assert.equal(privateData.breakdowns, null);
  assert.equal(privateData.modules, null);
  assert.equal(privateData.combat, null);
  const zero = profile({
    bullet_fired: 0,
    bullet_hit_player: 0,
    headshot: 20,
    kill_player: -1,
    deaths: NaN,
  });
  assert.equal(zero.combat?.accuracyPercent, 0);
  assert.equal(zero.combat?.headshotRatePercent, 0);
  assert.equal(zero.combat?.kdRatio, 0);
  assert.equal(zero.breakdowns?.totalKills, 0);
  assert.equal(zero.modules?.horse.kilometersRidden, 0);
});
