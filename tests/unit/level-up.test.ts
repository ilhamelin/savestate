import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSeenLevel,
  seenLevelKey,
  shouldCelebrateLevel,
  levelUpTitle,
} from '../../src/domain/level-up.ts';
test('Level up skips first visits and resets, celebrates increases and isolates browser accounts', () => {
  assert.equal(shouldCelebrateLevel(10, null), false);
  assert.equal(shouldCelebrateLevel(10, 10), false);
  assert.equal(shouldCelebrateLevel(1, 10), false);
  assert.equal(shouldCelebrateLevel(11, 10), true);
  assert.equal(shouldCelebrateLevel(50, 10), true);
  assert.notEqual(seenLevelKey('alice'), seenLevelKey('bob'));
  for (const input of [null, '', 'NaN', '-1', '0', '2.5', '10abc', '999999999999999999'])
    assert.equal(parseSeenLevel(input), null);
  assert.equal(parseSeenLevel('12'), 12);
  assert.equal(levelUpTitle(3), 'Button Masher');
  assert.equal(levelUpTitle(50), 'Final Boss');
});
