import test from 'node:test';
import assert from 'node:assert/strict';
import { operatorSignalInput, operatorSignalPayload } from '../../src/domain/operator-signals.ts';

test('Operator whispers validate bounded plain text and recipient-specific realtime payloads', () => {
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const other = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  assert.deepEqual(operatorSignalInput({ message: ' Hola ' }), { message: 'Hola' });
  for (const message of ['', ' ', 'a'.repeat(141), 42, null])
    assert.throws(() => operatorSignalInput({ message }));
  const payload = {
    id: other,
    user_id: userId,
    sender: 'ilhamelin_v2',
    message: 'Hola',
    sent_at: new Date().toISOString(),
  };
  assert.equal(operatorSignalPayload(payload, userId)?.message, 'Hola');
  assert.equal(operatorSignalPayload({ ...payload, message: undefined }, userId)?.message, null);
  assert.equal(operatorSignalPayload(payload, other), null);
  for (const extra of [
    { id: 'bad' },
    { sent_at: 'bad' },
    { sent_at: '2000-01-01' },
    { sender: '' },
    { message: 'a'.repeat(141) },
  ])
    assert.equal(operatorSignalPayload({ ...payload, ...extra }, userId), null);
});
