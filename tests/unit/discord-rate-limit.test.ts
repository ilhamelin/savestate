import test from 'node:test';
import assert from 'node:assert/strict';
import { discordRetryDelay } from '../../src/domain/discord-rate-limit.ts';
test('Discord retry delay respects fractional provider seconds with bounded, fail-closed waits', () => {
  assert.equal(discordRetryDelay('1.25'), 1350);
  assert.equal(discordRetryDelay(0), 100);
  assert.equal(discordRetryDelay(30), 30100);
  for (const value of [null, undefined, '', 'bad', -1, 31, Infinity, {}])
    assert.equal(discordRetryDelay(value), null);
});
