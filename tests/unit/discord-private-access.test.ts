import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discordPrivatePermissions,
  privateChatAllowedUser,
  linkedDiscordIdentity,
  NO_PRIVATE_ACCESS,
  privateDiscordAttachmentPath,
} from '../../src/domain/discord-private-access.ts';
const guildId = '111111111111111111',
  userId = '222222222222222222',
  channelId = '747219024324198532',
  roleId = '333333333333333333';
const input = {
  userId,
  guildId,
  channelId,
  guild: { id: guildId, owner_id: '999999999999999999' },
  roles: [
    { id: guildId, permissions: '101376' },
    { id: roleId, permissions: '0' },
  ],
  member: { user: { id: userId }, roles: [roleId] },
  channel: {
    id: channelId,
    guild_id: guildId,
    type: 0,
    permission_overwrites: [] as { id: string; type: number; allow: string; deny: string }[],
  },
};
test('Private Discord identity uses only a unique verified provider identity, not profile metadata', () => {
  assert.equal(
    linkedDiscordIdentity([{ provider: 'discord', identity_data: { provider_id: userId } }]),
    userId,
  );
  assert.equal(
    linkedDiscordIdentity([{ provider: 'discord', identity_data: { sub: userId } }]),
    userId,
  );
  for (const value of [
    null,
    { provider_id: userId },
    [{ provider: 'google', identity_data: { sub: userId } }],
    [{ provider: 'discord', identity_data: { sub: 'spoof' } }],
  ])
    assert.equal(linkedDiscordIdentity(value), null);
});
test('Private attachments bind the path to the authenticated owner and reject traversal and URLs', () => {
  const owner = '11111111-1111-4111-8111-111111111111',
    path = `${owner}/22222222-2222-4222-8222-222222222222.gif`;
  assert.equal(privateDiscordAttachmentPath(path, owner), path);
  assert.equal(privateDiscordAttachmentPath(undefined, owner), null);
  for (const value of [
    path.replace(owner, '33333333-3333-4333-8333-333333333333'),
    '../private.gif',
    'https://example.com/a.gif',
    path + '?x=1',
  ])
    assert.throws(() => privateDiscordAttachmentPath(value, owner));
});
test('Private channel permissions honor everyone/role/member overwrites and administrator/owner access', () => {
  assert.deepEqual(discordPrivatePermissions(input), {
    canRead: true,
    canSend: true,
    canAttach: true,
  });
  const channel = {
    ...input.channel,
    permission_overwrites: [{ id: guildId, type: 0, deny: '1024', allow: '0' }],
  };
  assert.deepEqual(discordPrivatePermissions({ ...input, channel }), NO_PRIVATE_ACCESS);
  channel.permission_overwrites.push({ id: roleId, type: 0, allow: '1024', deny: '0' });
  assert.equal(discordPrivatePermissions({ ...input, channel }).canRead, true);
  channel.permission_overwrites.push({ id: userId, type: 1, allow: '0', deny: '2048' });
  assert.deepEqual(discordPrivatePermissions({ ...input, channel }), {
    canRead: true,
    canSend: false,
    canAttach: false,
  });
  channel.permission_overwrites.push({ id: userId, type: 1, allow: '0', deny: '1024' });
  assert.deepEqual(discordPrivatePermissions({ ...input, channel }), NO_PRIVATE_ACCESS);
  assert.equal(
    discordPrivatePermissions({ ...input, channel, roles: [{ id: guildId, permissions: '8' }] })
      .canSend,
    true,
  );
  assert.equal(
    discordPrivatePermissions({ ...input, channel, guild: { id: guildId, owner_id: userId } })
      .canSend,
    true,
  );
});
test('Private access rejects malformed data, wrong members, missing history, timeout and membership screening sends', () => {
  for (const patch of [
    { member: null },
    { member: { user: { id: '999999999999999999' }, roles: [] } },
    { roles: null },
    { roles: [{ id: guildId, permissions: 'invalid' }] },
    { channel: { ...input.channel, guild_id: '999999999999999999' } },
    { channel: { ...input.channel, permission_overwrites: undefined } },
  ])
    assert.deepEqual(discordPrivatePermissions({ ...input, ...patch }), NO_PRIVATE_ACCESS);
  assert.equal(
    discordPrivatePermissions({ ...input, roles: [{ id: guildId, permissions: '3072' }] }).canRead,
    false,
  );
  assert.equal(
    discordPrivatePermissions({
      ...input,
      member: { ...input.member, communication_disabled_until: '2099-01-01T00:00:00Z' },
    }).canSend,
    false,
  );
  assert.equal(
    discordPrivatePermissions({ ...input, member: { ...input.member, pending: true } }).canSend,
    false,
  );
});

test('Private allowlist uses stable owner IDs and explicit UUIDs, never editable names', () => {
  assert.equal(privateChatAllowedUser('19767368-1c5d-46d9-a65e-f07814ab7e97'), true);
  assert.equal(privateChatAllowedUser('434de68c-f7f6-4364-b59f-a3a1a95adf36'), true);
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(privateChatAllowedUser(id), false);
  assert.equal(privateChatAllowedUser(id, ` , ${id}, `), true);
  assert.equal(privateChatAllowedUser('ilhamelin', 'ilhamelin'), false);
  assert.equal(privateChatAllowedUser(null), false);
});
