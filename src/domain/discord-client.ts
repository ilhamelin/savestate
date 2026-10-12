import { ValidationError } from './validation.ts';
export interface DiscordMessage {
  id: string;
  author: string;
  avatar: string | null;
  content: string;
  createdAt: string;
  attachments: { name: string; url: string }[];
  bot?: boolean;
  pinned?: boolean;
  authorId?: string | null;
  mentions?: DiscordMention[];
  replyTo?: { id: string; author: string; excerpt: string } | null;
}
export type DiscordMention = { id: string; username: string };
export type DiscordMentionTarget = {
  username: string;
  id: string | null;
  source: 'discord' | 'web' | 'presence';
};
export function discordMentionTargets(
  messages: DiscordMessage[],
  members: DiscordOnlineMember[],
): DiscordMentionTarget[] {
  const result: DiscordMentionTarget[] = [];
  const add = (target: DiscordMentionTarget) => {
    if (
      discordUsername(target.username) &&
      !result.some(
        (item) =>
          item.username.toLowerCase() === target.username.toLowerCase() && item.id === target.id,
      )
    )
      result.push(target);
  };
  for (const message of messages) {
    const origin = discordMessageOrigin(message.content);
    if (origin.web && origin.author) add({ username: origin.author, id: null, source: 'web' });
    else if (discordSnowflake(message.authorId))
      add({ username: message.author, id: message.authorId, source: 'discord' });
    for (const mention of message.mentions ?? []) add({ ...mention, source: 'discord' });
  }
  for (const member of members)
    if (!result.some((item) => item.username.toLowerCase() === member.username.toLowerCase()))
      add({ username: member.username, id: null, source: 'presence' });
  return result.slice(0, 100);
}
export type DiscordSendOptions = { replyToMessageId?: string; mentions?: DiscordMention[] };
export function discordSnowflake(value: unknown): value is string {
  return typeof value === 'string' && /^\d{16,22}$/.test(value);
}
export function discordUsername(value: unknown): string | null {
  return typeof value === 'string' &&
    value.trim() &&
    value.trim().length <= 80 &&
    ![...value].some(
      (character) =>
        character.charCodeAt(0) < 32 ||
        character.charCodeAt(0) === 127 ||
        '@<>`[]'.includes(character),
    )
    ? value.trim()
    : null;
}
export function discordSendOptions(input: unknown): DiscordSendOptions {
  const data = record(input),
    options: DiscordSendOptions = {};
  if (data.replyToMessageId !== undefined) {
    if (!discordSnowflake(data.replyToMessageId))
      throw new ValidationError('Respuesta de Discord inválida.');
    options.replyToMessageId = data.replyToMessageId;
  }
  if (data.mentions !== undefined) {
    if (!Array.isArray(data.mentions) || data.mentions.length > 5)
      throw new ValidationError('Puedes mencionar hasta 5 usuarios de Discord.');
    options.mentions = data.mentions.map((raw) => {
      const mention = record(raw),
        username = discordUsername(mention.username);
      if (!discordSnowflake(mention.id) || !username)
        throw new ValidationError('Mención de Discord inválida.');
      return { id: mention.id, username };
    });
  }
  return options;
}
const escapeMention = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function discordMentionPattern(names: string[]) {
  const choices = [...new Set(names.filter((name) => discordUsername(name)))].sort(
    (a, b) => b.length - a.length,
  );
  return choices.length
    ? new RegExp(
        `(^|[^\\p{L}\\p{N}_@])@(${choices.map(escapeMention).join('|')})(?![\\p{L}\\p{N}_])`,
        'giu',
      )
    : null;
}
export function discordHasMention(content: string, username: string) {
  return discordMentionPattern([username])?.test(content) ?? false;
}
export function discordMentionParts(
  content: string,
  names: string[],
): { text: string; mention: boolean }[] {
  const pattern = discordMentionPattern(names);
  if (!pattern) return [{ text: content, mention: false }];
  const parts: { text: string; mention: boolean }[] = [];
  let end = 0;
  for (const match of content.matchAll(pattern)) {
    const start = match.index + match[1]!.length;
    if (start > end) parts.push({ text: content.slice(end, start), mention: false });
    end = match.index + match[0].length;
    parts.push({ text: content.slice(start, end), mention: true });
  }
  if (end < content.length) parts.push({ text: content.slice(end), mention: false });
  return parts;
}
export function discordMessageMentioned(message: DiscordMessage, viewer: string | null) {
  return Boolean(
    viewer &&
    (discordHasMention(discordMessageOrigin(message.content).content, viewer) ||
      message.replyTo?.author.toLowerCase() === viewer.toLowerCase()),
  );
}
export function discordOutgoingMessage(
  content: string,
  options: DiscordSendOptions,
  recent: DiscordMessage[],
) {
  const checked = discordSendOptions(options);
  const authors = recent.flatMap((message) =>
    message.authorId ? [{ id: message.authorId, username: message.author }] : [],
  );
  const known = [...authors, ...recent.flatMap((message) => message.mentions ?? [])].filter(
    (m) => discordSnowflake(m.id) && discordUsername(m.username),
  );
  const selected = (checked.mentions ?? []).filter((m) =>
    known.some(
      (candidate) =>
        candidate.id === m.id && candidate.username.toLowerCase() === m.username.toLowerCase(),
    ),
  );
  if (selected.length !== (checked.mentions?.length ?? 0))
    throw new ValidationError('El usuario mencionado ya no está disponible en el canal.');
  const byName = new Map<string, DiscordMention>();
  for (const mention of known) {
    const name = mention.username.toLowerCase(),
      explicit = selected.find((m) => m.username.toLowerCase() === name);
    if (explicit) byName.set(name, explicit);
    else if (
      !byName.has(name) &&
      !known.some((m) => m.username.toLowerCase() === name && m.id !== mention.id)
    )
      byName.set(name, mention);
  }
  const users: string[] = [];
  const text = discordContent(content);
  const pattern = discordMentionPattern([...byName.values()].map((m) => m.username));
  const formatted = pattern
    ? text.replace(pattern, (whole, prefix: string, name: string) => {
        const id = byName.get(name.toLowerCase())!.id;
        if (!users.includes(id) && users.length >= 5) return whole;
        if (!users.includes(id)) users.push(id);
        return `${prefix}<@${id}>`;
      })
    : text;
  return {
    content: formatted,
    allowed_mentions: {
      parse: [] as string[],
      users,
      replied_user: Boolean(checked.replyToMessageId),
    },
    ...(checked.replyToMessageId
      ? { message_reference: { message_id: checked.replyToMessageId, fail_if_not_exists: false } }
      : {}),
  };
}
export type DiscordFrequency = 'web-chat' | 'checkpoints' | 'announcements';
export function discordFrequencyMessages(messages: DiscordMessage[], frequency: DiscordFrequency) {
  if (frequency === 'web-chat') return messages;
  return messages.filter((message) =>
    frequency === 'announcements'
      ? message.pinned === true
      : message.bot === true && !discordMessageOrigin(message.content).web,
  );
}
export function sameDiscordMessages(current: DiscordMessage[], next: DiscordMessage[]) {
  // Keep unchanged snapshots stable while still accepting edits and deletions.
  return (
    current.length === next.length &&
    current.at(-1)?.id === next.at(-1)?.id &&
    JSON.stringify(current) === JSON.stringify(next)
  );
}
export function discordNearBottom(scrollTop: number, clientHeight: number, scrollHeight: number) {
  return scrollHeight - scrollTop - clientHeight <= 80;
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
      ([
        'images.igdb.com',
        'media.valorant-api.com',
        'cdn.henrikdev.xyz',
        'ddragon.leagueoflegends.com',
      ].includes(url.hostname) ||
        (url.hostname === 'www.gamerpower.com' && url.pathname.startsWith('/offers/'))) &&
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
      const safeMentions = (Array.isArray(message.mentions) ? message.mentions : [])
        .slice(0, 100)
        .flatMap((item): DiscordMention[] => {
          const user = record(item);
          const username = discordUsername(user.global_name) ?? discordUsername(user.username);
          return discordSnowflake(user.id) && username && user.bot !== true
            ? [{ id: user.id, username }]
            : [];
        });
      const mentions = new Map(safeMentions.map((user) => [user.id, user.username]));
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
      const embedText = (Array.isArray(message.embeds) ? message.embeds : [])
        .slice(0, 5)
        .map((item) => {
          const embed = record(item);
          return [embed.title, embed.description]
            .filter((value): value is string => typeof value === 'string')
            .join('\n');
        })
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 4000);
      const referenceId = record(message.message_reference).message_id;
      const referenced = record(
        message.referenced_message ?? input.find((raw) => record(raw).id === referenceId),
      );
      const referencedContent = typeof referenced.content === 'string' ? referenced.content : '';
      const refOrigin = discordMessageOrigin(referencedContent);
      const refAuthor = record(referenced.author);
      const replyId = referenced.id ?? referenceId;
      const replyTo = discordSnowflake(replyId)
        ? {
            id: replyId,
            author:
              refOrigin.author ??
              discordUsername(refAuthor.global_name) ??
              discordUsername(refAuthor.username) ??
              'mensaje no disponible',
            excerpt: refOrigin.content
              .replace(/<@!?\d+>/g, '@usuario')
              .replace(/<[^>]*>/g, '')
              .split('')
              .map((character) =>
                character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character,
              )
              .join('')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 120),
          }
        : null;
      return [
        {
          id: message.id,
          author: String(author.global_name ?? author.username ?? 'Discord').slice(0, 80),
          avatar,
          content: [content, embedText].filter(Boolean).join('\n\n').slice(0, 6000),
          createdAt: new Date(message.timestamp).toISOString(),
          attachments,
          bot: author.bot === true || typeof message.webhook_id === 'string',
          pinned: message.pinned === true,
          authorId:
            author.bot !== true &&
            !message.webhook_id &&
            !discordMessageOrigin(content).web &&
            discordSnowflake(author.id)
              ? author.id
              : null,
          mentions: [...new Map(safeMentions.map((m) => [m.id, m])).values()],
          replyTo,
        },
      ];
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
