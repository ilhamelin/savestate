import { ValidationError } from './validation.ts';
export interface DiscordMessage {
  id: string;
  author: string;
  avatar: string | null;
  content: string;
  createdAt: string;
  attachments: { name: string; url: string }[];
}
export function discordContent(input: unknown) {
  if (
    typeof input !== 'string' ||
    !input.trim() ||
    [...input.trim()].length > 500 ||
    [...input].some((character) => {
      const code = character.charCodeAt(0);
      return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
    })
  )
    throw new ValidationError('El mensaje debe tener entre 1 y 500 caracteres.');
  return input.trim();
}
export function discordWebhook(input: string): string | null {
  try {
    const url = new URL(input);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'discord.com' ||
      url.port ||
      url.username ||
      url.password ||
      !/^\/api(?:\/v10)?\/webhooks\/\d{16,22}\/[\w-]+$/.test(url.pathname)
    )
      return null;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}
function record(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
}
export function normalizedDiscordMessages(input: unknown): DiscordMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, 30)
    .flatMap((item) => {
      const message = record(item),
        author = record(message.author);
      if (
        typeof message.id !== 'string' ||
        !/^\d{16,22}$/.test(message.id) ||
        typeof message.timestamp !== 'string' ||
        !Number.isFinite(Date.parse(message.timestamp))
      )
        return [];
      const mentions = new Map(
        (Array.isArray(message.mentions) ? message.mentions : []).map((item) => {
          const user = record(item);
          return [String(user.id), String(user.global_name ?? user.username ?? 'jugador')];
        }),
      );
      const content = (typeof message.content === 'string' ? message.content.slice(0, 4000) : '')
        .replace(/<@!?(\d+)>/g, (_, id: string) => `@${mentions.get(id) ?? 'jugador'}`)
        .replace(/<@&\d+>/g, '@rol')
        .replace(/<#\d+>/g, '#canal')
        .replace(/<a?:(\w+):\d+>/g, ':$1:');
      const attachments = (Array.isArray(message.attachments) ? message.attachments : [])
        .slice(0, 5)
        .flatMap((item) => {
          const attachment = record(item);
          try {
            const url = new URL(String(attachment.url));
            if (
              url.protocol !== 'https:' ||
              !['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname) ||
              url.username ||
              url.password
            )
              return [];
            return [
              { name: String(attachment.filename ?? 'Archivo').slice(0, 100), url: url.toString() },
            ];
          } catch {
            return [];
          }
        });
      const avatar =
        typeof author.id === 'string' &&
        /^\d{16,22}$/.test(author.id) &&
        typeof author.avatar === 'string' &&
        /^(?:a_)?[a-f0-9]{32}$/.test(author.avatar)
          ? `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png?size=64`
          : null;
      return [
        {
          id: message.id,
          author: String(author.global_name ?? author.username ?? 'Discord').slice(0, 80),
          avatar,
          content,
          createdAt: new Date(message.timestamp).toISOString(),
          attachments,
        },
      ];
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
