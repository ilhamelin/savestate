import { ValidationError } from './validation.ts';
export function privateDiscordAttachmentPath(value: unknown, ownerId: string): string | null {
  if (value == null) return null;
  if (
    typeof value !== 'string' ||
    !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(value) ||
    value.split('/')[0] !== ownerId
  )
    throw new ValidationError('Adjunto privado no autorizado.');
  return value;
}
export type DiscordPrivateAccess = { canRead: boolean; canSend: boolean; canAttach: boolean };
export const NO_PRIVATE_ACCESS: DiscordPrivateAccess = {
  canRead: false,
  canSend: false,
  canAttach: false,
};
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const snowflake = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{16,22}$/.test(value);
const bits = (value: unknown): bigint | null =>
  typeof value === 'string' && /^\d{1,40}$/.test(value) ? BigInt(value) : null;
// Stable IDs of ilhamelin_v2 / ilhamelin; renaming a profile must never transfer access.
export function privateChatAllowedUser(userId: unknown, configured = ''): boolean {
  if (typeof userId !== 'string' || !/^[a-f0-9-]{36}$/i.test(userId)) return false;
  const allowed = [
    '19767368-1c5d-46d9-a65e-f07814ab7e97',
    '434de68c-f7f6-4364-b59f-a3a1a95adf36',
    ...configured.split(','),
  ];
  return allowed.some((id) => id.trim().toLowerCase() === userId.toLowerCase());
}
export function linkedDiscordIdentity(identities: unknown): string | null {
  if (!Array.isArray(identities)) return null;
  const ids = identities
    .filter((item) => record(item).provider === 'discord')
    .flatMap((item) => {
      const data = record(record(item).identity_data);
      const id = data.provider_id ?? data.sub;
      return snowflake(id) ? [id] : [];
    });
  return ids.length === 1 ? ids[0]! : null;
}
export function discordPrivatePermissions(
  input: {
    userId: string;
    guildId: string;
    channelId: string;
    guild: unknown;
    roles: unknown;
    member: unknown;
    channel: unknown;
  },
  nowMs = Date.now(),
): DiscordPrivateAccess {
  const guild = record(input.guild),
    member = record(input.member),
    channel = record(input.channel);
  if (
    !snowflake(input.userId) ||
    guild.id !== input.guildId ||
    channel.guild_id !== input.guildId ||
    channel.id !== input.channelId ||
    channel.type !== 0 ||
    record(member.user).id !== input.userId ||
    !Array.isArray(member.roles) ||
    !Array.isArray(input.roles) ||
    !Array.isArray(channel.permission_overwrites)
  )
    return NO_PRIVATE_ACCESS;
  if (guild.owner_id === input.userId) return { canRead: true, canSend: true, canAttach: true };
  if (!member.roles.every(snowflake)) return NO_PRIVATE_ACCESS;
  const roleIds = new Set([input.guildId, ...member.roles]);
  const roles = input.roles.map(record).filter((role) => roleIds.has(String(role.id)));
  if (
    !roles.some((role) => role.id === input.guildId) ||
    roles.some((role) => bits(role.permissions) === null)
  )
    return NO_PRIVATE_ACCESS;
  let permissions = roles.reduce((value, role) => value | bits(role.permissions)!, 0n);
  if ((permissions & 8n) === 8n) return { canRead: true, canSend: true, canAttach: true };
  const overwrites = channel.permission_overwrites.map(record);
  if (
    overwrites.some(
      (item) =>
        !snowflake(item.id) ||
        (item.type !== 0 && item.type !== 1) ||
        bits(item.allow) === null ||
        bits(item.deny) === null,
    )
  )
    return NO_PRIVATE_ACCESS;
  const apply = (items: Record<string, unknown>[]) => {
    const deny = items.reduce((value, item) => value | bits(item.deny)!, 0n);
    const allow = items.reduce((value, item) => value | bits(item.allow)!, 0n);
    permissions = (permissions & ~deny) | allow;
  };
  apply(overwrites.filter((item) => item.type === 0 && item.id === input.guildId));
  apply(
    overwrites.filter(
      (item) => item.type === 0 && item.id !== input.guildId && roleIds.has(String(item.id)),
    ),
  );
  apply(overwrites.filter((item) => item.type === 1 && item.id === input.userId));
  const has = (flag: bigint) => (permissions & flag) === flag;
  const canRead = has(1024n) && has(65536n);
  const timedOut =
    typeof member.communication_disabled_until === 'string' &&
    Date.parse(member.communication_disabled_until) > nowMs;
  const canSend = canRead && has(2048n) && !timedOut && member.pending !== true;
  return { canRead, canSend, canAttach: canSend && has(32768n) };
}
