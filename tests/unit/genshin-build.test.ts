import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizedGenshin } from '../../src/domain/competitive-tracker.ts';
import { enkaIcon } from '../../src/domain/genshin-build.ts';
const store = {
  characters: {
    '10000096': {
      NameTextMapHash: 1,
      SideIconName: 'UI_AvatarIcon_Side_Test',
      QualityType: 'QUALITY_ORANGE',
      Element: 'Fire',
      SkillOrder: [101, 102, 103],
    },
  },
  locEs: { '1': 'Arlecchino', '2': 'Arma de prueba' },
  locEn: {},
};
test('Enka builds map Spanish names, actual equipment, talents, stats and account challenges', () => {
  const profile = normalizedGenshin(
    {
      playerInfo: {
        nickname: 'Traveler',
        stygianIndex: 6,
        stygianSeconds: 90,
        theaterActIndex: 10,
        showAvatarInfoList: [{ avatarId: 10000096, level: 90 }],
      },
      avatarInfoList: [
        {
          avatarId: 10000096,
          talentIdList: [1, 2],
          fetterInfo: { expLevel: 10 },
          skillLevelMap: { 101: 8, 102: 10, 103: 8 },
          fightPropMap: {
            2000: 19000.6,
            2001: 2200,
            2002: 800,
            20: 0.651,
            22: 1.852,
            23: 1.12,
            28: 45,
          },
          equipList: [
            {
              weapon: { level: 90, affixMap: { test: 2 } },
              flat: {
                nameTextMapHash: 2,
                icon: 'UI_EquipIcon_Sword_Test',
                rankLevel: 5,
                weaponStats: [
                  { appendPropId: 'FIGHT_PROP_BASE_ATTACK', statValue: 674 },
                  { appendPropId: 'FIGHT_PROP_CRITICAL', statValue: 22.1 },
                ],
              },
            },
            {
              reliquary: { level: 21 },
              flat: {
                icon: 'UI_RelicIcon_Test',
                rankLevel: 5,
                reliquaryMainstat: { mainPropId: 'FIGHT_PROP_CRITICAL_HURT', statValue: 62.2 },
              },
            },
          ],
        },
      ],
    },
    '618285856',
    store,
  );
  const character = profile.showcase[0]!;
  assert.equal(character.name, 'Arlecchino');
  assert.equal(character.elementCode, 'pyro');
  assert.equal(character.rarity, 5);
  assert.equal(character.constellations, 2);
  assert.equal(character.friendship, 10);
  assert.deepEqual(character.talents, [8, 10, 8]);
  assert.equal(character.stats?.hp, 19001);
  assert.equal(character.stats?.critRate, 65.1);
  assert.equal(character.stats?.critDmg, 185.2);
  assert.equal(character.stats?.energyRecharge, 112);
  assert.equal(character.weapon?.name, 'Arma de prueba');
  assert.equal(character.weapon?.refinement, 3);
  assert.equal(character.weapon?.baseAtk, 674);
  assert.equal(character.weapon?.substat, 'Prob. CRIT 22.1%');
  assert.equal(character.artifacts[0]?.level, 20);
  assert.equal(character.artifacts[0]?.mainStat, 'Daño CRIT 62.2%');
  assert.equal(profile.stygian, 'Nivel 6 · 90s');
  assert.equal(profile.theater, 'Acto 10');
});
test('Enka gracefully handles hidden builds, missing translations and untrusted image names', () => {
  const profile = normalizedGenshin(
    {
      playerInfo: { nickname: 'Traveler', showAvatarInfoList: [{ avatarId: 10000096, level: 90 }] },
    },
    '618285856',
    { ...store, locEs: {}, locEn: { '1': 'English name' } },
  );
  assert.equal(profile.showcase[0]?.name, 'English name');
  assert.equal(profile.showcase[0]?.stats, null);
  assert.equal(profile.showcase[0]?.weapon, null);
  assert.deepEqual(profile.showcase[0]?.talents, []);
  const fallback = normalizedGenshin(
    { playerInfo: { nickname: 'Traveler', showAvatarInfoList: [{ avatarId: 10000096 }] } },
    '618285856',
    { ...store, locEs: {}, locEn: {} },
  );
  assert.equal(fallback.showcase[0]?.name, 'Test');
  for (const icon of ['../../evil', 'UI_Test?secret', 'https://evil.example/x', 'UI_Test.svg'])
    assert.equal(enkaIcon(icon), null);
  assert.equal(enkaIcon('UI_AvatarIcon_Test'), 'https://enka.network/ui/UI_AvatarIcon_Test.png');
});
test('Enka resolves Traveler skill-depot variants and rejects nonfinite combat stats', () => {
  const profile = normalizedGenshin(
    {
      playerInfo: { nickname: 'Traveler', showAvatarInfoList: [{ avatarId: 10000007 }] },
      avatarInfoList: [
        { avatarId: 10000007, skillDepotId: 504, fightPropMap: { '2000': Infinity, '20': NaN } },
      ],
    },
    '618285856',
    {
      characters: {
        '10000007-504': { SideIconName: 'UI_AvatarIcon_Side_PlayerGirl', Element: 'Wind' },
      },
      locEs: {},
      locEn: {},
    },
  );
  assert.equal(profile.showcase[0]?.elementCode, 'anemo');
  assert.equal(profile.showcase[0]?.stats?.hp, 0);
  assert.equal(profile.showcase[0]?.stats?.critRate, 0);
});
