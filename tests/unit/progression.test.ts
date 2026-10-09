import test from 'node:test';
import assert from 'node:assert/strict';
import {
  levelFromXp,
  xpForLevel,
  xpProgress,
  unlockedRewards,
  equippedRewards,
} from '../../src/domain/progression.ts';
test('progression: coherent integer thresholds and progress boundaries', () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(xpForLevel(2), 100);
  assert.equal(xpForLevel(3), 314);
  for (let level = 2; level <= 100; level++) {
    const xp = xpForLevel(level);
    assert.equal(levelFromXp(xp), level);
    assert.equal(levelFromXp(xp - 1), level - 1);
    assert.equal(xpProgress(xp).current, 0);
    assert.equal(xpProgress(xp).percent, 0);
    assert.ok(xpProgress(xp - 1).percent < 100);
  }
  assert.deepEqual(xpProgress(50), { current: 50, max: 100, percent: 50 });
  for (const bad of [-1, NaN, Infinity, 1.5, 2147483648]) assert.throws(() => levelFromXp(bad));
  for (const bad of [0, -1, NaN, Infinity, 1.5]) assert.throws(() => xpForLevel(bad));
});
test('progression: locked cosmetics rejected; rewards persist beyond level fifty', () => {
  assert.deepEqual(unlockedRewards(1), { titles: ['Insert Coin'], frames: ['default'] });
  assert.ok(!unlockedRewards(4).frames.includes('bronze'));
  assert.ok(unlockedRewards(5).frames.includes('bronze'));
  assert.deepEqual(unlockedRewards(50), unlockedRewards(100));
  assert.equal(equippedRewards('Final Boss', 'boss', 50).equipped_frame, 'boss');
  assert.throws(() => equippedRewards('Final Boss', 'boss', 49));
  assert.throws(() => equippedRewards('<script>', 'default', 50));
  assert.throws(() => equippedRewards('Insert Coin', 'frame-injected', 50));
});
