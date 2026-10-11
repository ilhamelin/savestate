import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizedDiscordPresence } from '../../src/domain/discord.ts';

test('Discord widget preserves anonymized IDs, statuses, count and optional activity', () => {
  const result = normalizedDiscordPresence({
    presence_count: 140,
    members: [
      {
        id: '0',
        username: ' Player\n ',
        status: 'online',
        avatar_url: 'https://cdn.discordapp.com/widget-avatars/test',
        game: { name: 'Halo' },
      },
      {
        id: '1',
        username: 'Other',
        status: 'idle',
        avatar_url: 'https://media.discordapp.net/a.png',
      },
      { id: '2', username: 'Busy', status: 'dnd' },
    ],
  });
  assert.equal(result.onlineCount, 140);
  assert.equal(result.members.length, 3);
  assert.deepEqual(result.members[0], {
    id: '0',
    username: 'Player',
    status: 'online',
    avatar: 'https://cdn.discordapp.com/widget-avatars/test',
    game: 'Halo',
  });
  assert.equal(result.members[1]?.game, null);
  assert.equal(result.members[2]?.avatar, null);
});
test('Discord widget ignores malformed or duplicate members and unsafe avatar origins', () => {
  for (const input of [
    null,
    [],
    {},
    { presence_count: -1 },
    { presence_count: '3' },
    { presence_count: Infinity },
  ])
    assert.deepEqual(normalizedDiscordPresence(input), { onlineCount: 0, members: [] });
  const unsafe = [
    'javascript:alert(1)',
    'http://cdn.discordapp.com/a',
    'https://cdn.discordapp.com.evil.test/a',
    'https://user@cdn.discordapp.com/a',
    'https://media.discordapp.net:8080/a',
  ];
  const result = normalizedDiscordPresence({
    members: [
      ...unsafe.map((avatar_url, index) => ({
        id: String(index),
        username: 'Player',
        status: 'online',
        avatar_url,
      })),
      { id: '0', username: 'Duplicate', status: 'online' },
      { id: 'abc', username: 'Invalid ID', status: 'online' },
      { id: '9', username: '', status: 'online' },
      { id: '10', username: 'Offline', status: 'offline' },
      null,
    ],
  });
  assert.equal(result.members.length, unsafe.length);
  assert.ok(result.members.every((member) => member.avatar === null));
  assert.equal(
    normalizedDiscordPresence({
      members: Array.from({ length: 120 }, (_, id) => ({
        id: String(id),
        username: 'Player',
        status: 'online',
      })),
    }).members.length,
    100,
  );
});
