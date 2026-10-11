import { ValidationError } from './validation.ts';
export interface DiscordMessage {
  id: string;
  author: string;
  avatar: string | null;
  content: string;
  createdAt: string;
  attachments: { name: string; url: string }[];
}
export type DiscordOnlineMember = {
  id: string;
  username: string;
  status: 'online' | 'idle' | 'dnd';
  avatar: string | null;
  game: string | null;
};
export function normalizedDiscordPresence(payload: unknown): {
  onlineCount: number;
  members: DiscordOnlineMember[];
} {
  const input = record(payload);
  const cleanText = (value: unknown, max: number) =>
    typeof value === 'string'
      ? [...value]
          .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
          .join('')
          .trim()
          .slice(0, max)
      : '';
  const members: DiscordOnlineMember[] = [];
  const ids = new Set<string>();
  for (const item of (Array.isArray(input.members) ? input.members : []).slice(0, 100)) {
    const member = record(item);
    const username = cleanText(member.username, 80);
    // Widget IDs are anonymized indices, not Discord user snowflakes.
    if (
      typeof member.id !== 'string' ||
      !/^\d{1,22}$/.test(member.id) ||
      ids.has(member.id) ||
      !username ||
      (member.status !== 'online' && member.status !== 'idle' && member.status !== 'dnd')
    )
      continue;
    let avatar: string | null = null;
    try {
      const url = new URL(typeof member.avatar_url === 'string' ? member.avatar_url : '');
      if (
        url.protocol === 'https:' &&
        !url.port &&
        !url.username &&
        !url.password &&
        ['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname)
      )
        avatar = url.toString();
    } catch {
      /* Keep the avatar placeholder. */
    }
    ids.add(member.id);
    members.push({
      id: member.id,
      username,
      status: member.status,
      avatar,
      game: cleanText(record(member.game).name, 120) || null,
    });
  }
  return {
    onlineCount:
      typeof input.presence_count === 'number' &&
      Number.isSafeInteger(input.presence_count) &&
      input.presence_count >= 0
        ? input.presence_count
        : 0,
    members,
  };
}
export function discordMessageOrigin(content: string) {
  const match = /^(?:\*\*)?\[@([a-zA-Z0-9_]{1,30}) en Savestate\]:(?:\*\*)?\s*/.exec(content);
  return {
    web: Boolean(match),
    author: match?.[1],
    content: match ? content.slice(match[0].length) : content,
  };
}
export function discordCoverUrl(input?: string | null): string | null {
  try {
    const url = new URL(input ?? '');
    return url.protocol === 'https:' &&
      url.hostname === 'images.igdb.com' &&
      !url.port &&
      !url.username &&
      !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
export function discordImageAttachment(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      !parsed.port &&
      !parsed.username &&
      !parsed.password &&
      ['cdn.discordapp.com', 'media.discordapp.net'].includes(parsed.hostname) &&
      /\.(png|jpe?g|webp|gif)$/i.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}
// Keep inline image origins aligned with the proxy's img-src policy.
export function discordInlineMedia(content: string): { text: string; urls: string[] } {
  const urls: string[] = [];
  const text = content.replace(/https?:\/\/[^\s<>]+/gi, (raw) => {
    const candidate = raw.replace(/[.,!?;:)\]]+$/, '');
    try {
      const url = new URL(candidate);
      const gifProvider =
        ['media.tenor.com', 'c.tenor.com', 'klipy.com'].includes(url.hostname) ||
        url.hostname.endsWith('.giphy.com') ||
        url.hostname.endsWith('.klipy.com');
      const directImage = /\.(png|jpe?g|webp|gif)$/i.test(url.pathname);
      const imageHost = [
        'cdn.discordapp.com',
        'media.discordapp.net',
        'images.igdb.com',
        'img.itch.zone',
      ].includes(url.hostname);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        !(gifProvider || (imageHost && directImage))
      )
        return raw;
      const normalized = url.toString();
      if (!urls.includes(normalized)) {
        if (urls.length >= 5) return raw;
        urls.push(normalized);
      }
      return raw.slice(candidate.length);
    } catch {
      return raw;
    }
  });
  return { text: text.trim(), urls };
}
export function discordInvite(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
    const valid =
      (url.hostname === 'discord.gg' && /^\/[\w-]+\/?$/.test(url.pathname)) ||
      (url.hostname === 'discord.com' && /^\/invite\/[\w-]+\/?$/.test(url.pathname));
    if (!valid) return null;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}
export function completedDiscordProgress(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const progress = input as Record<string, unknown>;
  return (
    ['gamerscore', 'trophies', 'achievements'].includes(String(progress.kind)) &&
    typeof progress.current === 'number' &&
    Number.isInteger(progress.current) &&
    typeof progress.total === 'number' &&
    Number.isInteger(progress.total) &&
    progress.total > 0 &&
    progress.current === progress.total
  );
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
