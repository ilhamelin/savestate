import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discordContent,
  discordInvite,
  completedDiscordProgress,
  discordWebhook,
  normalizedDiscordMessages,
  discordMessageOrigin,
  discordCoverUrl,
  discordImageAttachment,
  discordInlineMedia,
  discordComposerPayload,
} from '../../src/domain/discord.ts';
test('Discord inline media preserves text, signed URLs and restricts external origins', () => {
  const gif = 'https://media.tenor.com/example/retro.gif';
  assert.deepEqual(discordInlineMedia(`Hola ${gif} ¡GG!`), { text: 'Hola  ¡GG!', urls: [gif] });
  assert.deepEqual(discordInlineMedia(`${gif} ${gif}`), { text: '', urls: [gif] });
  for (const url of [
    'https://cdn.discordapp.com/attachments/a.png?ex=123&sig=abc',
    'https://media.giphy.com/media/example/giphy.gif',
    'https://i.giphy.com/example.webp',
    'https://c.tenor.com/example',
    'https://klipy.com/gifs/example.gif',
    'https://media.klipy.com/example.gif',
  ])
    assert.equal(discordInlineMedia(url).urls.length, 1);
  for (const url of [
    'http://media.tenor.com/example.gif',
    'https://media.tenor.com.evil.test/example.gif',
    'https://user@media.giphy.com/example.gif',
    'https://media.tenor.com:8080/example.gif',
    'https://evil.test/example.png',
    'https://cdn.discordapp.com/attachments/example.svg',
    'https://klipy.com/gifs/example',
  ])
    assert.deepEqual(discordInlineMedia(url), { text: url, urls: [] });
  assert.equal(
    discordInlineMedia(
      Array.from({ length: 6 }, (_, n) => `https://i.giphy.com/${n}.gif`).join(' '),
    ).urls.length,
    5,
  );
  assert.deepEqual(discordInlineMedia(`Mira (${gif}).`), { text: 'Mira ().', urls: [gif] });
});
test('Discord composer allows media-only posts and preserves 500 characters independently of the URL', () => {
  const url = 'https://i.imgur.com/example.gif';
  assert.deepEqual(discordComposerPayload('', url), { content: '', mediaUrl: url });
  assert.equal(discordComposerPayload('x'.repeat(500), url).content.length, 500);
  assert.throws(() => discordComposerPayload('x'.repeat(501), url));
  assert.throws(() => discordComposerPayload('', null));
  assert.throws(() => discordComposerPayload('hello', 'https://i.imgur.com.evil.test/a.gif'));
  const id = '11111111-1111-4111-8111-111111111111';
  const origin = 'https://example.supabase.co';
  const storage = `${origin}/storage/v1/object/public/chat-media/${id}/a.gif`;
  assert.equal(discordComposerPayload('hello', storage, origin, id).mediaUrl, storage);
  assert.throws(() => discordComposerPayload('hello', storage, origin, 'different-owner'));
  assert.deepEqual(discordInlineMedia(`Hola ${storage}`, origin), {
    text: 'Hola',
    urls: [storage],
  });
});
test('Discord resolves GIF page embeds to direct safe media without accepting arbitrary image hosts', () => {
  const message = {
    id: '222222222222222222',
    author: { username: 'player' },
    timestamp: '2026-10-13T12:00:00Z',
    content: 'https://tenor.com/view/example',
    embeds: [
      { image: { url: 'https://media.tenor.com/example/retro.gif' } },
      { image: { url: 'https://evil.test/a.gif' } },
    ],
  };
  const normalized = normalizedDiscordMessages([message])[0]!;
  assert.deepEqual(normalized.attachments, [
    { name: 'Imagen / GIF', url: 'https://media.tenor.com/example/retro.gif' },
  ]);
  assert.ok(normalized.content.includes('https://tenor.com/view/example'));
});
test('Discord presentation cleans web prefixes and validates image origins', () => {
  assert.deepEqual(discordMessageOrigin('**[@player en Savestate]:** Hola'), {
    web: true,
    author: 'player',
    content: 'Hola',
  });
  assert.equal(discordMessageOrigin('[@player en Savestate]: Hola').content, 'Hola');
  assert.equal(discordMessageOrigin('Hola [@player en Savestate]:').web, false);
  assert.equal(discordImageAttachment('https://cdn.discordapp.com/a.JPG?ex=123'), true);
  assert.equal(discordImageAttachment('https://media.discordapp.net/a.gif'), true);
  for (const url of [
    'https://evil.test/a.png',
    'https://cdn.discordapp.com/a.svg',
    'https://user@cdn.discordapp.com/a.png',
  ])
    assert.equal(discordImageAttachment(url), false);
  assert.equal(
    discordCoverUrl('https://images.igdb.com/igdb/image/upload/t_cover_big/test.jpg'),
    'https://images.igdb.com/igdb/image/upload/t_cover_big/test.jpg',
  );
  for (const url of [
    undefined,
    'http://images.igdb.com/a.jpg',
    'https://images.igdb.com.evil.test/a.jpg',
    'https://user@images.igdb.com/a.jpg',
  ])
    assert.equal(discordCoverUrl(url), null);
});
test('Discord invite links and 100% checkpoints reject unsafe or incomplete values', () => {
  assert.equal(
    discordInvite('https://discord.gg/SaveState?source=web'),
    'https://discord.gg/SaveState',
  );
  assert.equal(
    discordInvite('https://discord.com/invite/retro'),
    'https://discord.com/invite/retro',
  );
  for (const value of [
    '',
    'http://discord.gg/test',
    'https://discord.gg.evil.test/test',
    'https://user@discord.gg/test',
    'https://discord.com/api/webhooks/123/key',
  ])
    assert.equal(discordInvite(value), null);
  for (const kind of ['gamerscore', 'trophies', 'achievements'])
    assert.equal(completedDiscordProgress({ kind, current: 10, total: 10 }), true);
  for (const value of [
    null,
    { kind: 'achievements', current: 0, total: 0 },
    { kind: 'trophies', current: 9, total: 10 },
    { kind: 'unknown', current: 1, total: 1 },
    { kind: 'gamerscore', current: 11, total: 10 },
  ])
    assert.equal(completedDiscordProgress(value), false);
});
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
