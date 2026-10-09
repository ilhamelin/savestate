import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discordContent,
  discordWebhook,
  normalizedDiscordMessages,
} from '../../src/domain/discord.ts';
test('Discord validates message length and confines webhook credentials to the official host', () => {
  assert.equal(discordContent(' hello '), 'hello');
  for (const value of ['', 'a'.repeat(501), null, 'bad\0'])
    assert.throws(() => discordContent(value));
  assert.equal(discordContent('🎮'.repeat(500)).length, 1000);
  assert.equal(
    discordWebhook('https://discord.com/api/webhooks/123456789012345678/abc_-123?wait=true'),
    'https://discord.com/api/webhooks/123456789012345678/abc_-123',
  );
  for (const value of [
    'https://evil.test/api/webhooks/123456789012345678/key',
    'https://discord.com.evil.test/api/webhooks/123456789012345678/key',
    'https://user@discord.com/api/webhooks/123456789012345678/key',
    'http://discord.com/api/webhooks/123456789012345678/key',
  ])
    assert.equal(discordWebhook(value), null);
});
test('Discord normalization preserves text without HTML injection and filters attachment origins', () => {
  const messages = normalizedDiscordMessages([
    {
      id: '123456789012345678',
      timestamp: '2026-10-09T12:00:00Z',
      author: { id: '223456789012345678', username: 'player', avatar: 'a'.repeat(32) },
      content: '<@323456789012345678> <:gg:423456789012345678> <script>x</script>',
      mentions: [{ id: '323456789012345678', username: 'friend' }],
      attachments: [
        { filename: 'capture.png', url: 'https://cdn.discordapp.com/attachments/test.png' },
        { url: 'javascript:alert(1)' },
        { url: 'https://cdn.discordapp.com.evil.test/a' },
      ],
    },
    { id: 'invalid', timestamp: 'bad' },
  ]);
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.author, 'player');
  assert.match(messages[0]!.content, /@friend :gg:/);
  assert.equal(messages[0]?.attachments.length, 1);
  assert.match(messages[0]!.avatar!, /^https:\/\/cdn.discordapp.com\/avatars\//);
  assert.deepEqual(normalizedDiscordMessages(null), []);
});
