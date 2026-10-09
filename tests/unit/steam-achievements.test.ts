import test from 'node:test';
import assert from 'node:assert/strict';
import { steamAchievementSummary, steamLogAppId } from '../../src/domain/steam-achievements.ts';
import { consoleProgressLabel } from '../../src/domain/console-progress.ts';

test('Steam counts unlocked achievements without inventing absent or malformed stats', () => {
  const summary = steamAchievementSummary({
    playerstats: {
      success: true,
      achievements: [{ achieved: 1 }, { achieved: 0 }, { achieved: 1 }],
    },
  });
  assert.deepEqual(summary, { kind: 'achievements', current: 2, total: 3 });
  assert.equal(consoleProgressLabel(summary!), '[Steam] 2 / 3 logros (67%)');
  assert.deepEqual(
    steamAchievementSummary({ playerstats: { success: true, achievements: [{ achieved: 0 }] } }),
    { kind: 'achievements', current: 0, total: 1 },
  );
  for (const invalid of [
    null,
    {},
    { playerstats: { success: false } },
    { playerstats: { success: true, achievements: [] } },
    { playerstats: { success: true, achievements: [{ achieved: '1' }] } },
    { playerstats: { success: true, achievements: [null] } },
  ])
    assert.equal(steamAchievementSummary(invalid), null);
});

test('Steam achievements require an imported Steam log with a valid uint32 app ID', () => {
  assert.equal(steamLogAppId('PC / Steam', '[Steam lifetime:730] Partida importada'), 730);
  assert.equal(steamLogAppId('PC / Steam', '[Steam lifetime:4294967295]'), 4294967295);
  for (const note of [
    '[Steam lifetime:0]',
    '[Steam lifetime:4294967296]',
    '[Steam lifetime:1.2]',
    'Nota [Steam lifetime:730]',
    '[Steam lifetime:abc]',
  ])
    assert.equal(steamLogAppId('PC / Steam', note), null);
  assert.equal(steamLogAppId('Xbox One', '[Steam lifetime:730]'), null);
});
