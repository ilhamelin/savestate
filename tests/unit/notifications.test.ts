import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationAge, NOTIFICATION_LABELS } from '../../src/domain/notifications.ts';
test('señales: tiempo relativo determinista, fechas futuras y tipos de momentos', () => {
  const now = '2026-10-07T12:00:00Z';
  assert.equal(notificationAge(now, now), 'ahora');
  assert.equal(notificationAge('2026-10-07T11:55:00Z', now), 'hace 5 minutos');
  assert.equal(notificationAge('2026-10-07T10:00:00Z', now), 'hace 2 horas');
  assert.equal(notificationAge('2026-10-05T12:00:00Z', now), 'hace 2 días');
  assert.equal(notificationAge('2026-10-08T12:00:00Z', now), 'ahora');
  assert.equal(notificationAge('bad', now), '');
  assert.equal(NOTIFICATION_LABELS.post_comment, 'comentó en tu momento gamer');
  assert.equal(NOTIFICATION_LABELS.post_reaction, 'reaccionó a tu momento gamer');
});
