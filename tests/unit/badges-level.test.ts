import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePlayerLevel,
  badgeUnlockNotification,
  badgeUnlockEvent,
  type Badge,
} from '../../src/domain/badges.ts';

for (const [earned, level, title, next] of [
  [0, 1, 'Iniciado del Checkpoint', 1],
  [1, 2, 'Coleccionista Novato', 3],
  [2, 2, 'Coleccionista Novato', 3],
  [3, 3, 'Explorador de Cartuchos', 5],
  [4, 3, 'Explorador de Cartuchos', 5],
  [5, 4, 'Veterano de Bóveda', 7],
  [6, 4, 'Veterano de Bóveda', 7],
  [7, 5, 'Leyenda del Guardado', null],
] as const) {
  test(`SPEC-02: ${earned} badges yield level ${level} and the next exact threshold`, () => {
    assert.deepEqual(calculatePlayerLevel(earned, 7), {
      level,
      title,
      earnedCount: earned,
      totalCount: 7,
      progressPercentage: Math.round((earned / 7) * 100),
      nextLevelThreshold: next,
    });
  });
}
test('Badge progression handles an empty catalogue without division by zero', () => {
  assert.equal(calculatePlayerLevel(0, 0).progressPercentage, 0);
  assert.equal(calculatePlayerLevel(0, 0).level, 1);
  assert.equal(calculatePlayerLevel(0, 0).nextLevelThreshold, 1);
  assert.equal(calculatePlayerLevel(7, 0).progressPercentage, 0);
});
test('Badge progression normalizes invalid counts, floors fractions and caps the progress bar', () => {
  for (const value of [NaN, Infinity, -Infinity, -3]) {
    const player = calculatePlayerLevel(value, value);
    assert.equal(player.earnedCount, 0);
    assert.equal(player.totalCount, 0);
    assert.equal(player.progressPercentage, 0);
    assert.equal(player.level, 1);
  }
  assert.equal(calculatePlayerLevel(2.9, 7.9).earnedCount, 2);
  assert.equal(calculatePlayerLevel(2.9, 7.9).totalCount, 7);
  assert.equal(calculatePlayerLevel(20, 7).progressPercentage, 100);
  assert.equal(calculatePlayerLevel(20, 7).nextLevelThreshold, null);
  assert.equal(calculatePlayerLevel(Number.MAX_VALUE, 1).earnedCount, Number.MAX_SAFE_INTEGER);
});
test('Badge events require the current recipient, a badge notification and a valid timestamp', () => {
  const row = {
    id: 'notice',
    badge_id: 'first_checkpoint',
    user_id: 'alice',
    kind: 'badge_unlocked',
    created_at: '2026-10-22T12:00:00Z',
  };
  const parsed = badgeUnlockNotification(row, 'alice');
  assert.deepEqual(parsed, {
    id: 'notice',
    badgeId: 'first_checkpoint',
    unlockedAt: '2026-10-22T12:00:00.000Z',
  });
  for (const value of [
    null,
    [],
    {},
    { ...row, kind: 'follow' },
    { ...row, badge_id: null },
    { ...row, user_id: 'bob' },
    { ...row, created_at: 'bad' },
    { ...row, id: '' },
  ])
    assert.equal(badgeUnlockNotification(value, 'alice'), null);
  const badge = {
    id: 'first_checkpoint',
    name: 'Primer Guardado',
    description: 'Tu primer juego',
    icon_pixel: 'save',
    category: 'milestone',
    created_at: row.created_at,
  } as Badge;
  assert.ok(parsed);
  assert.deepEqual(badgeUnlockEvent(parsed, badge), {
    badgeId: badge.id,
    badgeName: badge.name,
    badgeDescription: badge.description,
    iconPixel: 'save',
    unlockedAt: parsed.unlockedAt,
  });
  assert.equal(badgeUnlockEvent(parsed, { ...badge, id: 'other' }), null);
  assert.equal(badgeUnlockEvent(parsed, { ...badge, name: '' }), null);
});
