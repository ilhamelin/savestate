import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chatCursor,
  chatFileSignature,
  detectMediaType,
  mergeChatMessages,
  safeChatMediaUrl,
  sanitizeChatText,
  validateChatFile,
  validateChatMessagePayload,
  type GlobalChatMessage,
} from './global-chat.ts';
const id = '11111111-1111-4111-8111-111111111111';
test('global chat validates content or media and binds authenticated owner', () => {
  assert.equal(
    validateChatMessagePayload({ content: ' hello ', user_id: 'spoof' }, id).user_id,
    id,
  );
  assert.equal(
    validateChatMessagePayload({ mediaUrl: 'https://i.imgur.com/test.gif' }, id).media_type,
    'gif',
  );
  assert.throws(() => validateChatMessagePayload({ content: ' ' }, id));
  assert.throws(() => validateChatMessagePayload({ content: 'x'.repeat(1001) }, id));
  assert.throws(() => validateChatMessagePayload({ mediaUrl: 'javascript:alert(1)' }, id));
  assert.throws(() => validateChatMessagePayload({ content: 123 }, id));
});
test('chat media URLs reject spoofed domains and another owner storage path', () => {
  const storage = 'https://example.supabase.co';
  const path = `/storage/v1/object/public/chat-media/${id}/a.gif`;
  assert.equal(safeChatMediaUrl(path, storage, id), storage + path);
  assert.equal(safeChatMediaUrl(path, storage, '22222222-2222-4222-8222-222222222222'), null);
  for (const url of [
    'https://i.imgur.com.evil.example/a.gif',
    'http://i.imgur.com/a.gif',
    'https://user@i.imgur.com/a.gif',
    'https://i.imgur.com:444/a.gif',
    'https://tenor.com/view/a',
    'https://i.imgur.com/a.svg',
  ])
    assert.equal(safeChatMediaUrl(url), null);
  assert.equal(
    safeChatMediaUrl('https://media.giphy.com/media/abc/giphy.gif'),
    'https://media.giphy.com/media/abc/giphy.gif',
  );
});
test('chat text preserves multiline plain text and strips controls', () => {
  assert.equal(sanitizeChatText('  a\u0000   b\r\n\n\n\n c  '), 'a b\n\n\n c');
  assert.equal(detectMediaType('image/gif'), 'gif');
  assert.equal(detectMediaType('https://i.imgur.com/a.GIF?x=1'), 'gif');
  assert.equal(detectMediaType('image/webp'), 'image');
});

test('chat accepts official TMDB image URLs while rejecting spoofed or unsafe origins', () => {
  const url = 'https://image.tmdb.org/t/p/w780/poster.jpg';
  assert.equal(safeChatMediaUrl(url), url);
  for (const value of [
    'http://image.tmdb.org/t/p/w780/poster.jpg',
    'https://image.tmdb.org.evil.example/poster.jpg',
    'https://user@image.tmdb.org/poster.jpg',
    'https://image.tmdb.org/poster.svg',
    'https://image.tmdb.org/poster.html',
  ])
    assert.equal(safeChatMediaUrl(value), null);
});
test('chat files enforce exact 5 MB and format signature', () => {
  assert.doesNotThrow(() => validateChatFile(5242880, 'image/gif'));
  for (const size of [0, -1, 5242881, NaN])
    assert.throws(() => validateChatFile(size, 'image/gif'));
  assert.throws(() => validateChatFile(10, 'image/svg+xml'));
  assert.equal(chatFileSignature(new TextEncoder().encode('GIF89a1234'), 'image/gif'), true);
  assert.equal(chatFileSignature(new TextEncoder().encode('<script>'), 'image/png'), false);
});
test('chat cursor preserves microseconds and rejects query injection', () => {
  assert.deepEqual(chatCursor(`2026-10-13T10:00:00.123456+00:00|${id}`), {
    date: '2026-10-13T10:00:00.123456+00:00',
    id,
  });
  assert.throws(() => chatCursor('2026-10-13T00:00:00Z,or(id.gt.0)'));
  assert.throws(() => chatCursor(`2026-10-13T00:00:00Z|not-uuid`));
});
test('realtime and own echo are deduplicated and history stays chronological', () => {
  const message = (key: string, time: string) =>
    ({ id: key, createdAt: time }) as GlobalChatMessage;
  const first = message('a', '2026-10-13T01:00:00Z'),
    second = message('b', '2026-10-13T02:00:00Z');
  assert.deepEqual(
    mergeChatMessages([second], [first, second]).map((row) => row.id),
    ['a', 'b'],
  );
});
