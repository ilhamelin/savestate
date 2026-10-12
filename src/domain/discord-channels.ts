import type { DiscordFrequency } from './discord-client.ts';
export function discordFrequency(value: unknown): DiscordFrequency | null {
  return value === 'web-chat' || value === 'checkpoints' || value === 'announcements'
    ? value
    : null;
}
export function authorizedDiscordChannels(
  payload: unknown,
  guildId: string,
  primary: string,
  overrides: { checkpoints?: string; announcements?: string } = {},
): Record<DiscordFrequency, string | null> {
  const channels = (Array.isArray(payload) ? payload : []).filter(
    (channel): channel is { id: string; name: string; type: number; guild_id?: string } =>
      !!channel &&
      typeof channel === 'object' &&
      typeof channel.id === 'string' &&
      /^\d{16,22}$/.test(channel.id) &&
      typeof channel.name === 'string' &&
      (channel.type === 0 || channel.type === 5) &&
      (channel.guild_id === undefined || channel.guild_id === guildId),
  );
  const select = (name: string, explicit?: string) => {
    const matches = channels.filter(
      (channel) =>
        channel.id !== primary &&
        (explicit ? channel.id === explicit : channel.name.toLowerCase().includes(name)),
    );
    return matches.length === 1 ? matches[0]!.id : null;
  };
  return {
    'web-chat': channels.some((channel) => channel.id === primary) ? primary : null,
    checkpoints: select('checkpoints', overrides.checkpoints),
    announcements: select('anuncios-savestate', overrides.announcements),
  };
}
