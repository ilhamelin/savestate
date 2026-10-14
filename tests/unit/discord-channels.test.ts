import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizedDiscordChannels, discordFrequency } from '../../src/domain/discord-channels.ts';
const guild = '111111111111111111',
  primary = '222222222222222222';
const channels = [
  { id: primary, name: '💬-web-chat', type: 0, guild_id: guild },
  { id: '333333333333333333', name: '💾-checkpoints', type: 0, guild_id: guild },
  { id: '444444444444444444', name: '📢-anuncios-savestate', type: 5, guild_id: guild },
];
test('Discord channel mapping permits only known frequencies and same-guild text channels', () => {
  assert.deepEqual(authorizedDiscordChannels(channels, guild, primary), {
    'web-chat': primary,
    checkpoints: '333333333333333333',
    announcements: '444444444444444444',
    'chat-privado': null,
  });
  for (const value of ['web-chat', 'checkpoints', 'announcements', 'chat-privado'])
    assert.equal(discordFrequency(value), value);
  for (const value of [primary, 'admin', 'https://evil.test', null, {}, ''])
    assert.equal(discordFrequency(value), null);
  assert.deepEqual(
    authorizedDiscordChannels(
      [
        channels[0],
        { id: '333333333333333333', name: 'checkpoints', type: 2, guild_id: guild },
        {
          id: '444444444444444444',
          name: 'anuncios-savestate',
          type: 0,
          guild_id: '999999999999999999',
        },
      ],
      guild,
      primary,
    ),
    { 'web-chat': primary, checkpoints: null, announcements: null, 'chat-privado': null },
  );
});
test('Discord channel overrides are validated and ambiguous discoveries remain unavailable', () => {
  const duplicate = { id: '555555555555555555', name: 'old-checkpoints', type: 0, guild_id: guild };
  assert.equal(
    authorizedDiscordChannels([...channels, duplicate], guild, primary).checkpoints,
    null,
  );
  assert.equal(
    authorizedDiscordChannels([...channels, duplicate], guild, primary, {
      checkpoints: duplicate.id,
    }).checkpoints,
    duplicate.id,
  );
  assert.equal(
    authorizedDiscordChannels(channels, guild, primary, { checkpoints: '999999999999999999' })
      .checkpoints,
    null,
  );
  assert.equal(
    authorizedDiscordChannels(channels, guild, primary, { checkpoints: primary }).checkpoints,
    null,
  );
  assert.deepEqual(authorizedDiscordChannels(null, guild, primary), {
    'web-chat': null,
    checkpoints: null,
    announcements: null,
    'chat-privado': null,
  });
});
test('Private chat resolves the configured same-guild text channel and rejects foreign or unknown overrides', () => {
  const privateChannel = {
    id: '747219024324198532',
    name: '〘🕵〙chat-privado',
    type: 0,
    guild_id: guild,
  };
  assert.equal(
    authorizedDiscordChannels([...channels, privateChannel], guild, primary)['chat-privado'],
    privateChannel.id,
  );
  assert.equal(
    authorizedDiscordChannels(
      [...channels, { ...privateChannel, id: '666666666666666666' }],
      guild,
      primary,
    )['chat-privado'],
    '666666666666666666',
  );
  assert.equal(
    authorizedDiscordChannels([...channels, privateChannel], guild, primary, {
      privateChat: '999999999999999999',
    })['chat-privado'],
    null,
  );
  assert.equal(
    authorizedDiscordChannels(
      [...channels, { ...privateChannel, guild_id: '999999999999999999' }],
      guild,
      primary,
    )['chat-privado'],
    null,
  );
  assert.equal(
    authorizedDiscordChannels([...channels, { ...privateChannel, type: 2 }], guild, primary)[
      'chat-privado'
    ],
    null,
  );
});
