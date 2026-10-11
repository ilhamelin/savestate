import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chatInput,
  mergeMessages,
  missingChatTable,
  type FriendMessage,
} from '../../src/domain/friend-chat.ts';
const friendId = '11111111-1111-4111-8111-111111111111';
test('Chat validation enforces a friend UUID and trimmed nonempty bounded messages', () => {
  assert.deepEqual(chatInput({ friendId, content: ' hello ' }), { friendId, content: 'hello' });
  for (const content of ['', ' ', 'x'.repeat(501)])
    assert.throws(() => chatInput({ friendId, content }));
  assert.throws(() => chatInput({ friendId: 'bad', content: 'hello' }));
  assert.equal(missingChatTable({ code: 'PGRST205' }), true);
  assert.equal(missingChatTable({ code: '42501' }), false);
});
test('Chat merges out-of-order history and repeated broadcasts with a 50-message window', () => {
  const rows: FriendMessage[] = Array.from({ length: 60 }, (_, index) => ({
    id: String(index),
    sender_id: friendId,
    receiver_id: friendId,
    content: String(index),
    created_at: new Date(index * 1000).toISOString(),
  }));
  const merged = mergeMessages(rows.slice(0, 30).reverse(), rows);
  assert.equal(merged.length, 50);
  assert.equal(merged[0]?.content, '10');
  assert.equal(merged.at(-1)?.content, '59');
});
