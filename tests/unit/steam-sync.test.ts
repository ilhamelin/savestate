import test from 'node:test';
import assert from 'node:assert/strict';
import { steamSyncQuota } from '../../src/domain/steam-sync.ts';
test('Steam quota: initial state, three daily uses and rollover at UTC midnight', () => {
  const now = new Date('2026-10-08T23:59:59.999Z');
  assert.deepEqual(steamSyncQuota(0, null, now), {
    remainingSlots: 3,
    resetAt: '2026-10-09T00:00:00.000Z',
  });
  for (const count of [1, 2, 3])
    assert.equal(steamSyncQuota(count, '2026-10-08T00:00:00Z', now).remainingSlots, 3 - count);
  assert.equal(
    steamSyncQuota(3, '2026-10-08T23:59:59Z', new Date('2026-10-09T00:00:00Z')).remainingSlots,
    3,
  );
});
test('Steam quota: calendar dates use UTC regardless of an offset timestamp', () => {
  // In Chile this is still October 8; UTC has already crossed its boundary.
  const now = new Date('2026-10-08T21:00:00-03:00');
  assert.equal(steamSyncQuota(3, '2026-10-08T20:59:59-03:00', now).remainingSlots, 3);
  assert.equal(steamSyncQuota(2, '2026-10-08T21:00:00-03:00', now).remainingSlots, 1);
  assert.equal(steamSyncQuota(9, '2026-10-09T00:00:00Z', now).remainingSlots, 0);
});
