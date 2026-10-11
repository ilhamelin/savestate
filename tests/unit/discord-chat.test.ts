import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizedDiscordMessages,
  discordFrequencyMessages,
  sameDiscordMessages,
  discordNearBottom,
} from '../../src/domain/discord.ts';

test('Discord frequencies use real bot/webhook and pinned metadata, preserving rich alerts', () => {
  const messages = normalizedDiscordMessages([
    {
      id: '111111111111111111',
      timestamp: '2026-10-11T12:00:00Z',
      author: { username: 'Bot', bot: true },
      content: '**[@player en Savestate]:** GG',
    },
    {
      id: '222222222222222222',
      timestamp: '2026-10-11T12:01:00Z',
      author: { username: 'SaveState' },
      webhook_id: '123',
      embeds: [{ title: 'Nuevo platino', description: '100% conseguido' }],
    },
    {
      id: '333333333333333333',
      timestamp: '2026-10-11T12:02:00Z',
      author: { username: 'Mod' },
      pinned: true,
      content: 'Parche de la comunidad',
    },
  ]);
  assert.equal(discordFrequencyMessages(messages, 'web-chat'), messages);
  assert.deepEqual(
    discordFrequencyMessages(messages, 'checkpoints').map((message) => message.id),
    ['222222222222222222'],
  );
  assert.deepEqual(
    discordFrequencyMessages(messages, 'announcements').map((message) => message.id),
    ['333333333333333333'],
  );
  assert.equal(messages[1]?.content, 'Nuevo platino\n100% conseguido');
});
test('Discord polling keeps identical batches stable but notices edits, deletions and new arrivals', () => {
  const messages = normalizedDiscordMessages([
    { id: '111111111111111111', timestamp: '2026-10-11T12:00:00Z', content: 'Hola' },
  ]);
  assert.equal(sameDiscordMessages(messages, structuredClone(messages)), true);
  assert.equal(sameDiscordMessages(messages, [{ ...messages[0]!, content: 'Editado' }]), false);
  assert.equal(sameDiscordMessages(messages, []), false);
  assert.equal(
    sameDiscordMessages(messages, [...messages, { ...messages[0]!, id: '222222222222222222' }]),
    false,
  );
  assert.equal(discordNearBottom(420, 500, 1000), true);
  assert.equal(discordNearBottom(419, 500, 1000), false);
  assert.equal(discordNearBottom(0, 500, 300), true);
});
