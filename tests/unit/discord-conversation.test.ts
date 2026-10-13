import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizedDiscordMessages,
  discordOutgoingMessage,
  discordSendOptions,
  discordMentionTargets,
  discordMessageMentioned,
  discordMentionParts,
  type DiscordMessage,
} from '../../src/domain/discord-client.ts';
const humanId = '111111111111111111',
  otherId = '222222222222222222',
  messageId = '333333333333333333';
const human: DiscordMessage = {
  id: messageId,
  author: 'Native.Player',
  authorId: humanId,
  avatar: null,
  content: 'Hola',
  createdAt: '2026-10-12T12:00:00Z',
  attachments: [],
};
test('Discord conversation normalization preserves only genuine human IDs and sane mentions/replies', () => {
  const messages = normalizedDiscordMessages([
    {
      id: messageId,
      author: { id: humanId, username: 'Native.Player' },
      content: '<@222222222222222222> Hola',
      mentions: [
        { id: otherId, username: 'Friend' },
        { id: 'bad', username: 'Other' },
        { id: humanId, username: '<script>' },
      ],
      timestamp: human.createdAt,
    },
    {
      id: '444444444444444444',
      author: { id: humanId, username: 'Bridge', bot: true },
      content: '**[@savestate_user en Savestate]:** hello',
      timestamp: human.createdAt,
      message_reference: { message_id: messageId },
    },
    {
      id: '555555555555555555',
      author: { id: otherId, username: 'Webhook' },
      webhook_id: '123',
      content: 'reply',
      timestamp: human.createdAt,
      referenced_message: {
        id: messageId,
        author: { username: 'Bridge', bot: true },
        content: `**[@savestate_user en Savestate]:** ${'x'.repeat(200)}`,
      },
    },
  ]);
  assert.equal(messages[0]?.authorId, humanId);
  assert.deepEqual(messages[0]?.mentions, [{ id: otherId, username: 'Friend' }]);
  assert.match(messages[0]!.content, /^@Friend Hola/);
  assert.equal(messages[1]?.authorId, null);
  assert.equal(messages[1]?.replyTo?.author, 'Native.Player');
  assert.equal(messages[2]?.authorId, null);
  assert.equal(messages[2]?.replyTo?.author, 'savestate_user');
  assert.equal(messages[2]?.replyTo?.excerpt.length, 120);
});
test('Discord native mentions notify at most five verified IDs, with no mass or role parsing', () => {
  const outgoing = discordOutgoingMessage(
    '@native.player hola @everyone @here <@&999999999999999999>',
    { replyToMessageId: messageId },
    [human],
  );
  assert.match(outgoing.content, /^<@111111111111111111> hola @everyone/);
  assert.deepEqual(outgoing.allowed_mentions, { parse: [], users: [humanId], replied_user: true });
  assert.deepEqual(outgoing.message_reference, {
    message_id: messageId,
    fail_if_not_exists: false,
  });
  assert.equal(
    discordOutgoingMessage('mail@Native.Player y @Native.PlayerExtra', {}, [human]).allowed_mentions
      .users.length,
    0,
  );
  assert.throws(
    () =>
      discordOutgoingMessage(
        '@Native.Player',
        { mentions: [{ id: otherId, username: 'Native.Player' }] },
        [human],
      ),
    /disponible/,
  );
  for (const value of [
    { replyToMessageId: 'bad' },
    { mentions: [{ id: humanId, username: '@everyone' }] },
    { mentions: Array(6).fill({ id: humanId, username: 'Player' }) },
  ])
    assert.throws(() => discordSendOptions(value));
  const six = Array.from({ length: 6 }, (_, i) => ({
    ...human,
    authorId: String(BigInt(humanId) + BigInt(i)),
    author: `user${i}`,
  }));
  const limited = discordOutgoingMessage(six.map((m) => `@${m.author}`).join(' '), {}, six);
  assert.equal(limited.allowed_mentions.users.length, 5);
  assert.ok(limited.content.endsWith('@user5'));
});
test('Discord name collisions require explicit selection and widget presence never becomes a native ID', () => {
  const sameName = { ...human, authorId: otherId };
  assert.equal(
    discordOutgoingMessage('@Native.Player', {}, [human, sameName]).allowed_mentions.users.length,
    0,
  );
  assert.deepEqual(
    discordOutgoingMessage(
      '@Native.Player',
      { mentions: [{ id: humanId, username: 'Native.Player' }] },
      [human, sameName],
    ).allowed_mentions.users,
    [humanId],
  );
  const targets = discordMentionTargets(
    [human, { ...human, authorId: null, content: '**[@web_user en Savestate]:** Hi' }],
    [{ id: otherId, username: 'Widget user', status: 'online', avatar: null, game: null }],
  );
  assert.equal(targets.find((t) => t.username === 'web_user')?.id, null);
  assert.equal(targets.find((t) => t.username === 'Widget user')?.id, null);
});
test('Discord mention chips/highlights honor case and token boundaries and preserve literal text', () => {
  const message = { ...human, content: '**[@author en Savestate]:** Hola @VIEWER, @viewer2' };
  assert.equal(discordMessageMentioned(message, 'viewer'), true);
  assert.equal(discordMessageMentioned(message, 'view'), false);
  assert.equal(
    discordMessageMentioned(
      { ...human, replyTo: { id: messageId, author: 'Viewer', excerpt: 'old' } },
      'viewer',
    ),
    true,
  );
  assert.equal(discordMessageMentioned(human, null), false);
  const parts = discordMentionParts('<script> Hi @Native.Player, email@Native.Player', [
    'Native.Player',
  ]);
  assert.equal(parts.filter((part) => part.mention).length, 1);
  assert.equal(
    parts.map((part) => part.text).join(''),
    '<script> Hi @Native.Player, email@Native.Player',
  );
});
