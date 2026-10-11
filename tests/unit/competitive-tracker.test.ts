import test from 'node:test';
import assert from 'node:assert/strict';
import { competitiveInput, normalizedGenshin } from '../../src/domain/competitive-tracker.ts';
test('Competitive input rejects invalid UIDs, regions and ambiguous Riot IDs', () => {
  assert.deepEqual(competitiveInput({ game: 'genshin', uid: '618285856' }), {
    game: 'genshin',
    uid: '618285856',
  });
  for (const uid of ['123', 'a18285856', '12345678901', '618285856/'])
    assert.throws(() => competitiveInput({ game: 'genshin', uid }));
  assert.equal(
    competitiveInput({ game: 'valorant', riotId: 'User#TAG', region: 'eu' }).game,
    'valorant',
  );
  for (const input of [
    { game: 'valorant', riotId: 'User#TAG', region: 'invalid' },
    { game: 'valorant', riotId: 'User#A#B', region: 'na' },
    { game: 'unknown' },
  ])
    assert.throws(() => competitiveInput(input));
});
test('Genshin maps public profile and actual elemental energy from detailed avatars', () => {
  const profile = normalizedGenshin(
    {
      playerInfo: {
        nickname: 'Traveler',
        level: 60,
        worldLevel: 9,
        finishAchievementNum: 1200,
        towerFloorIndex: 12,
        towerLevelIndex: 3,
        showAvatarInfoList: [
          { avatarId: 10000002, level: 90 },
          { avatarId: 10000003, level: 80 },
        ],
      },
      avatarInfoList: [{ avatarId: 10000002, fightPropMap: { '75': 80 } }],
    },
    '618285856',
  );
  assert.equal(profile.abyss, '12-3');
  assert.equal(profile.showcase[0]?.element, 'Cryo ❄️');
  assert.equal(profile.showcase[1]?.element, 'Elemento no disponible');
  assert.throws(() => normalizedGenshin({}, '618285856'));
});
