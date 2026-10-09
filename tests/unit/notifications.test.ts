import test from 'node:test';
import assert from 'node:assert/strict';
import {
  notificationAge,
  NOTIFICATION_LABELS,
  pendingNotificationFriendship,
} from '../../src/domain/notifications.ts';
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
test('solicitudes: vincula solo la petición pendiente del remitente y excluye señales antiguas', () => {
  const requests = [{ id: 'request', sender_id: 'sender', created_at: '2026-10-09T12:00:00Z' }];
  const notification = {
    kind: 'friend_request',
    actor_id: 'sender',
    created_at: '2026-10-09T12:00:00+00:00',
  };
  assert.equal(pendingNotificationFriendship(notification, requests), 'request');
  assert.equal(
    pendingNotificationFriendship(
      { ...notification, created_at: '2026-10-08T12:00:00Z' },
      requests,
    ),
    null,
  );
  assert.equal(
    pendingNotificationFriendship({ ...notification, actor_id: 'other' }, requests),
    null,
  );
  assert.equal(
    pendingNotificationFriendship({ ...notification, kind: 'friend_accepted' }, requests),
    null,
  );
  assert.equal(pendingNotificationFriendship(notification, []), null);
});
