import test from 'node:test';
import assert from 'node:assert/strict';
import {
  genshinBuild,
  resolveConstellationList,
  resolveTalentList,
  resolveGenshinProfileIconUrl,
  resolveGenshinNameCardUrl,
  resolveGenshinRegionLabel,
  resolveCharacterSplashUrl,
  type EnkaStore,
} from '../genshin-build.ts';
import { normalizedGenshin } from '../competitive-tracker.ts';
const meta = {
  SideIconName: 'UI_AvatarIcon_Side_Shougun',
  NameTextMapHash: 1,
  Element: 'Electric',
  QualityType: 'QUALITY_ORANGE',
  Consts: Array.from({ length: 6 }, (_, i) => `UI_Talent_S_Shougun_0${i + 1}`),
  SkillOrder: [101, 102, 103],
  Skills: { 101: 'Skill_A_03', 102: 'Skill_S_Shougun_01', 103: 'Skill_E_Shougun_01' },
  ProudMap: { 101: 1001, 102: 1002, 103: 1003 },
};
const store: EnkaStore = {
  characters: { '10000052': meta },
  locEs: { 1: 'Shogun Raiden', 2: 'Emblema del Destino' },
  locEn: {},
  pfps: { 100: { iconPath: 'UI_AvatarIcon_Ambor_Circle' } },
  namecards: { 210001: { icon: 'UI_NameCardPic_0_P' } },
};
const details = {
  fightPropMap: {
    '1': 10000.3,
    '2000': 23456.8,
    '4': 800,
    '2001': 2300,
    '7': 600,
    '2002': 1000,
    '20': 0.55,
    '22': 1.8,
    '23': 2.4,
    '26': 0.15,
    '27': 0.2,
    '30': 0.1,
    '41': 0.466,
    '28': 80,
  },
  skillLevelMap: { 101: 6, 102: 8, 103: 9 },
  proudSkillExtraLevelMap: { 1003: 3 },
  talentIdList: [1, 2, 3],
  fetterInfo: { expLevel: 10 },
};
test('Genshin inspector resolves base/bonus, percentage stats and constellation boosts', () => {
  const build = genshinBuild(10000052, details, store);
  assert.equal(build.stats?.baseHp, 10000);
  assert.equal(build.stats?.bonusHp, 13457);
  assert.equal(build.stats?.maxHp, 23457);
  assert.equal(build.stats?.baseAtk, 800);
  assert.equal(build.stats?.bonusAtk, 1500);
  assert.equal(build.stats?.baseDef, 600);
  assert.equal(build.stats?.bonusDef, 400);
  assert.equal(build.stats?.healingBonus, 15);
  assert.equal(build.stats?.incomingHealingBonus, 20);
  assert.equal(build.stats?.physicalDmgBonus, 10);
  assert.equal(build.stats?.elementalDmgBonus.value, 46.6);
  assert.equal(build.constellationsList.length, 6);
  assert.deepEqual(
    build.constellationsList.map((c) => c.unlocked),
    [true, true, true, false, false, false],
  );
  assert.equal(build.talentsList[2]?.level, 12);
  assert.equal(build.talentsList[2]?.boosted, true);
  assert.match(build.talentsList[0]!.iconUrl!, /Skill_A_03.png$/);
  assert.equal(build.friendshipLevel, 10);
  assert.match(build.splashUrl!, /UI_Gacha_AvatarImg_Shougun.png$/);
});
test('Genshin artifacts keep fixed slot order, localized sets and highlighted substats', () => {
  const slots = ['EQUIP_DRESS', 'EQUIP_BRACER', 'EQUIP_RING', 'EQUIP_NECKLACE'];
  const equipList = slots.map((equipType, i) => ({
    reliquary: { level: 21 },
    flat: {
      equipType,
      icon: `UI_RelicIcon_15020_${i + 1}`,
      rankLevel: 5,
      setNameTextMapHash: 2,
      reliquaryMainstat: { mainPropId: 'FIGHT_PROP_CRITICAL_HURT', statValue: 62.2 },
      reliquarySubstats: [
        { appendPropId: 'FIGHT_PROP_CRITICAL', statValue: 10.1 },
        { appendPropId: 'FIGHT_PROP_ATTACK', statValue: 19 },
        { appendPropId: 'FIGHT_PROP_HP_PERCENT', statValue: 5.8 },
        { appendPropId: 'FIGHT_PROP_ELEMENT_MASTERY', statValue: 40 },
      ],
    },
  }));
  const build = genshinBuild(10000052, { ...details, equipList }, store);
  assert.deepEqual(
    build.artifacts.map((a) => a.slot),
    ['EQUIP_BRACER', 'EQUIP_NECKLACE', 'EQUIP_RING', 'EQUIP_DRESS'],
  );
  assert.equal(build.artifacts[0]?.level, 20);
  assert.equal(build.artifacts[0]?.setName, 'Emblema del Destino');
  assert.equal(build.artifacts[0]?.mainStatValue, '62.2%');
  assert.deepEqual(
    build.artifacts[0]?.substats.map((s) => s.isHighlight),
    [true, false, true, true],
  );
  assert.equal(build.artifacts[0]?.substats[2]?.valueText, '5.8%');
  assert.deepEqual(build.activeArtifactSets, [{ setName: 'Emblema del Destino', count: 4 }]);
});
test('Genshin profile metadata resolves official icons, namecards, server and zero endgame values', () => {
  assert.equal(
    resolveGenshinProfileIconUrl({ id: 100 }, store),
    'https://enka.network/ui/UI_AvatarIcon_Ambor_Circle.png',
  );
  assert.match(
    resolveGenshinProfileIconUrl({ id: 999, avatarId: 10000052 }, store)!,
    /UI_AvatarIcon_Shougun.png$/,
  );
  assert.match(resolveGenshinNameCardUrl(210001, store)!, /UI_NameCardPic_0_P.png$/);
  assert.deepEqual(
    ['600000001', '700000001', '800000001', '1800000001', '900000001'].map(
      resolveGenshinRegionLabel,
    ),
    ['America Server', 'Europe Server', 'Asia Server', 'Asia Server', 'TW/HK/MO Server'],
  );
  const profile = normalizedGenshin(
    {
      playerInfo: {
        nickname: 'Traveler',
        profilePicture: { id: 100 },
        nameCardId: 210001,
        stygianIndex: 0,
        stygianSeconds: 0,
        theaterStarIndex: 0,
      },
    },
    '600000001',
    store,
  );
  assert.equal(profile.stygianSeconds, 0);
  assert.equal(profile.theaterStars, 0);
  assert.equal(profile.regionLabel, 'America Server');
  assert.equal(profile.showcase.length, 0);
});
test('Genshin inspector preserves unavailable data and rejects unsafe asset paths', () => {
  assert.equal(genshinBuild(10000052, undefined, store).stats, null);
  assert.deepEqual(resolveTalentList(undefined, meta), []);
  assert.equal(resolveConstellationList(undefined, 99).length, 6);
  assert.equal(resolveCharacterSplashUrl('https://evil.test/image'), null);
  assert.equal(resolveGenshinNameCardUrl(999, store), null);
  const fallback = resolveTalentList(
    { skillLevelMap: { 99: 4 } },
    { Skills: { 99: 'Skill_A_03' } },
  );
  assert.equal(fallback[0]?.level, 4);
  const clamped = genshinBuild(10000052, { fightPropMap: { '1': 200, '2000': 100 } }, store);
  assert.equal(clamped.stats?.bonusHp, 0);
});
