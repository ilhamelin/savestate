import test from 'node:test';
import assert from 'node:assert/strict';
import {
  competitiveInput,
  normalizedHsr,
  normalizedRust,
  type HsrEnkaStore,
} from '../competitive-tracker.ts';
const store: HsrEnkaStore = {
  locEs: { character: '7 de Marzo', cone: 'Cono español' },
  locEn: { english: 'English hero' },
  avatars: {
    '1001': {
      AvatarName: { Hash: 'character' },
      Rarity: 4,
      Element: 'Ice',
      AvatarBaseType: 'Knight',
      AvatarSideIconPath: '/ui/hsr/1001.png',
      Promotion: {
        '0': {
          HPBase: 100,
          HPAdd: 10,
          AttackBase: 50,
          AttackAdd: 5,
          DefenceBase: 60,
          DefenceAdd: 6,
          SpeedBase: 100,
          CriticalChance: 0.05,
          CriticalDamage: 0.5,
        },
      },
    },
  },
  weapons: {
    '2001': {
      EquipmentName: { Hash: 'cone' },
      ImagePath: '/ui/hsr/cone.png',
      Rarity: 5,
      Promotion: {
        '0': {
          BaseHP: 20,
          BaseHPAdd: 2,
          BaseAttack: 10,
          BaseAttackAdd: 1,
          BaseDefence: 10,
          BaseDefenceAdd: 1,
        },
      },
    },
  },
};
test('HSR validates UIDs, localizes builds and combines level, equipment and relic properties', () => {
  assert.deepEqual(competitiveInput({ game: 'hsr', uid: '8000000010' }), {
    game: 'hsr',
    uid: '8000000010',
  });
  for (const uid of ['123', '800000001/', '80000000100', 'abcdefghi'])
    assert.throws(() => competitiveInput({ game: 'hsr', uid }));
  const detailInfo = {
    uid: '800000001',
    nickname: 'Trailblazer',
    level: 70,
    worldLevel: 6,
    recordInfo: { achievementCount: 45, avatarCount: 8, equipmentCount: 10 },
    avatarDetailList: [
      {
        avatarId: 1001,
        level: 2,
        rank: 3,
        promotion: 0,
        equipment: {
          tid: 2001,
          level: 2,
          rank: 5,
          _flat: { props: { BaseHP: 20, BaseAttack: 10, BaseDefence: 10 } },
        },
        relicList: [
          {
            _flat: {
              props: {
                HPAddedRatio: 0.1,
                HPDelta: 7,
                AttackAddedRatio: 0.2,
                AttackDelta: 4,
                DefenceDelta: 3,
                SpeedDelta: 5,
                CriticalChanceBase: 0.1,
                CriticalDamageBase: 0.2,
              },
            },
          },
        ],
      },
    ],
  };
  const profile = normalizedHsr({ detailInfo }, '800000001', store),
    c = profile.showcase[0]!;
  assert.equal(profile.achievements, 45);
  assert.equal(profile.lightConeCount, 10);
  assert.equal(c.name, '7 de Marzo');
  assert.equal(c.path, 'Conservación');
  assert.equal(c.element, 'Hielo ❄️');
  assert.equal(c.eidolons, 3);
  assert.equal(c.lightCone?.superimposition, 5);
  assert.equal(c.lightCone?.name, 'Cono español');
  assert.equal(c.iconUrl, 'https://enka.network/ui/hsr/1001.png');
  assert.deepEqual(c.stats, { hp: 150, atk: 82, def: 79, speed: 105, critRate: 15, critDmg: 70 });
  const fallback = normalizedHsr(
    {
      detailInfo: {
        ...detailInfo,
        avatarDetailList: [{ avatarId: 1001, level: 2, equipment: { tid: 2001, level: 2 } }],
      },
    },
    '800000001',
    store,
  );
  assert.equal(fallback.showcase[0]?.stats?.hp, 132);
  assert.equal(normalizedHsr({ detailInfo }, '800000001').showcase[0]?.stats, null);
  assert.throws(() => normalizedHsr({}, '800000001'));
  assert.throws(() => normalizedHsr({ detailInfo }, '800000002'));
});
test('HSR empty showcases, missing metadata and hostile image paths degrade safely', () => {
  const result = normalizedHsr(
    {
      detailInfo: {
        nickname: 'Player',
        avatarDetailList: [
          { avatarId: 8001, rank: 100 },
          { avatarId: 8001 },
          { avatarId: -1 },
          { avatarId: 1001 },
        ],
      },
    },
    '800000001',
    {
      ...store,
      avatars: {
        '1001': { AvatarName: { Hash: 'english' }, AvatarSideIconPath: '//evil.test/x', Rarity: 5 },
      },
    },
  );
  assert.equal(result.showcase.length, 2);
  assert.equal(result.showcase[0]?.name, 'Trazacaminos');
  assert.equal(result.showcase[0]?.eidolons, 6);
  assert.equal(result.showcase[1]?.name, 'English hero');
  assert.equal(result.showcase[1]?.iconUrl, null);
  assert.equal(
    normalizedHsr({ detailInfo: { nickname: 'Player' } }, '800000001').showcase.length,
    0,
  );
});
const id = '76561198000000001';
const summary = {
  response: {
    players: [
      {
        steamid: id,
        personaname: 'Rust player',
        avatarfull: 'https://avatars.steamstatic.com/avatar.jpg',
      },
    ],
  },
};
test('Rust accepts numeric, URL and vanity identities while rejecting arbitrary hosts and malformed IDs', () => {
  for (const steamId of [id, `https://steamcommunity.com/profiles/${id}/`])
    assert.deepEqual(competitiveInput({ game: 'rust', steamId }), {
      game: 'rust',
      target: { steamid: id },
    });
  for (const steamId of ['rust_player', 'https://steamcommunity.com/id/rust_player'])
    assert.deepEqual(competitiveInput({ game: 'rust', steamId }), {
      game: 'rust',
      target: { vanity: 'rust_player' },
    });
  for (const steamId of [
    '123',
    'https://evil.test/id/player',
    'https://user@steamcommunity.com/id/player',
    'rust player',
    'https://steamcommunity.com/id/player?x=1',
  ])
    assert.throws(() => competitiveInput({ game: 'rust', steamId }));
});
test('Rust maps actual lifetime stats, counts unlocked achievements and preserves privacy as unavailable', () => {
  const rows = {
    kill_player: 10,
    deaths: 4,
    bullet_fired: 200,
    bullet_hit_player: 50,
    headshot: 8,
    kill_bear: 2,
    kill_chicken: 3,
    harvested_wood: 1234.6,
    'acquired_metal.ore': 42,
    wounded_healed: 9,
  };
  const stats = {
    playerstats: {
      steamID: id,
      stats: Object.entries(rows).map(([name, value]) => ({ name, value })),
      achievements: [{ name: 'earned' }],
    },
  };
  const owned = {
    response: { games: [{ appid: 252490, playtime_forever: 123, playtime_2weeks: 60 }] },
  };
  const profile = normalizedRust(summary, owned, stats, id, {
    playerstats: {
      steamID: id,
      success: true,
      achievements: [{ achieved: 1 }, { achieved: 0 }, { achieved: 1 }],
    },
  });
  assert.equal(profile.hoursPlayed, 2.1);
  assert.equal(profile.recentHours2Weeks, 1);
  assert.equal(profile.achievementsUnlocked, 2);
  assert.equal(profile.combat?.kdRatio, 2.5);
  assert.equal(profile.combat?.accuracyPercent, 25);
  assert.equal(profile.combat?.animalsKilled, 5);
  assert.equal(profile.survival?.woodHarvested, 1235);
  assert.equal(profile.survival?.metalOre, 42);
  assert.equal(normalizedRust(summary, owned, stats, id).achievementsUnlocked, 1);
  const privateProfile = normalizedRust(summary, owned, null, id);
  assert.equal(privateProfile.hoursPlayed, 2.1);
  assert.equal(privateProfile.statsPublic, false);
  assert.equal(privateProfile.combat, null);
  assert.equal(privateProfile.survival, null);
  assert.equal(normalizedRust(summary, null, null, id).hoursPlayed, null);
  assert.equal(
    normalizedRust(summary, owned, { playerstats: { ...stats.playerstats, steamID: 'other' } }, id)
      .statsPublic,
    false,
  );
  assert.throws(() => normalizedRust({ response: { players: [] } }, owned, stats, id));
  assert.equal(
    normalizedRust(
      {
        response: {
          players: [
            {
              ...summary.response.players[0],
              avatarfull: 'https://evil.test/avatar.jpg',
              profileurl: 'https://evil.test',
            },
          ],
        },
      },
      owned,
      stats,
      id,
    ).avatarUrl,
    null,
  );
});
