import { ValidationError, object, uuid } from './validation.ts';

export type ChatMediaType = 'image' | 'gif';
export type ChatMessageAuthor = { id: string; username: string; avatarUrl: string | null };
export type GlobalChatMessage = {
  id: string;
  userId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: ChatMediaType | null;
  createdAt: string;
  author: ChatMessageAuthor;
};
export type GlobalChatRow = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: ChatMediaType | null;
  created_at: string;
};
export const CHAT_MEDIA_LIMIT = 5 * 1024 * 1024;
export const CHAT_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export function sanitizeChatText(content: string): string {
  return [...content.replace(/\r\n?/g, '\n')]
    .filter(
      (character) =>
        (character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127) ||
        character === '\n' ||
        character === '\t',
    )
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}
export function detectMediaType(value: string): ChatMediaType {
  return value === 'image/gif' || /\.gif(?:[?#]|$)/i.test(value) ? 'gif' : 'image';
}
export function safeChatMediaUrl(
  value: unknown,
  storageOrigin?: string,
  ownerId?: string,
): string | null {
  if (
    typeof value !== 'string' ||
    value.length > 2000 ||
    /[\s\\]/.test(value) ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    return null;
  try {
    const url = new URL(value, value.startsWith('/storage/') ? storageOrigin : undefined);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (storageOrigin && url.origin === new URL(storageOrigin).origin) {
      const prefix = '/storage/v1/object/public/chat-media/';
      if (!url.pathname.startsWith(prefix)) return null;
      const path = decodeURIComponent(url.pathname.slice(prefix.length));
      if (!/^[a-f0-9-]{36}\/[a-zA-Z0-9_.-]+\.(png|jpe?g|webp|gif)$/i.test(path)) return null;
      if (ownerId && !path.startsWith(ownerId + '/')) return null;
      return url.href;
    }
    const hosts = [
      'i.imgur.com',
      'media.tenor.com',
      'c.tenor.com',
      'media.giphy.com',
      'i.giphy.com',
      'cdn.discordapp.com',
      'media.discordapp.net',
      'klipy.com',
    ];
    if (!hosts.includes(url.hostname) && !url.hostname.endsWith('.klipy.com')) return null;
    if (!/\.(png|jpe?g|webp|gif)(?:$|\/)/i.test(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
}
export function validateChatMessagePayload(input: unknown, userId: string, storageOrigin?: string) {
  const data = object(input);
  const owner = uuid(userId);
  if (data.content != null && typeof data.content !== 'string')
    throw new ValidationError('Mensaje inválido.');
  if (typeof data.content === 'string' && data.content.length > 1000)
    throw new ValidationError('Máximo 1000 caracteres.');
  const content = sanitizeChatText((data.content as string | null) ?? '') || null;
  const rawMedia = data.mediaUrl ?? data.media_url;
  const mediaUrl =
    rawMedia == null || rawMedia === '' ? null : safeChatMediaUrl(rawMedia, storageOrigin, owner);
  if (rawMedia && !mediaUrl)
    throw new ValidationError(
      'Usa un enlace HTTPS directo de Tenor, Giphy, Imgur, Discord o tu archivo subido.',
    );
  if (!content && !mediaUrl)
    throw new ValidationError('Escribe un mensaje o adjunta una imagen/GIF.');
  const requestedType = data.mediaType ?? data.media_type;
  if (requestedType != null && !['image', 'gif'].includes(String(requestedType)))
    throw new ValidationError('Tipo multimedia inválido.');
  return {
    user_id: owner,
    content,
    media_url: mediaUrl,
    media_type: mediaUrl ? detectMediaType(mediaUrl) : null,
  };
}
export function validateChatFile(size: number, mime: string) {
  if (!Number.isInteger(size) || size <= 0 || size > CHAT_MEDIA_LIMIT)
    throw new ValidationError('El archivo debe pesar entre 1 byte y 5 MB.');
  if (!CHAT_MIMES.includes(mime as (typeof CHAT_MIMES)[number]))
    throw new ValidationError('Solo PNG, JPG, WebP o GIF.');
}
export function chatFileSignature(bytes: Uint8Array, mime: string): boolean {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  return mime === 'image/png'
    ? bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10'
    : mime === 'image/jpeg'
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mime === 'image/gif'
        ? ['GIF87a', 'GIF89a'].includes(ascii(0, 6))
        : mime === 'image/webp' && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
}
export function chatCursor(before?: string): { date: string; id: string | null } | null {
  if (!before) return null;
  const [date = '', id, extra] = before.split('|');
  if (
    extra ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(date) ||
    !Number.isFinite(Date.parse(date))
  )
    throw new ValidationError('Cursor inválido.');
  return { date, id: id ? uuid(id) : null };
}
export function mergeChatMessages(
  previous: GlobalChatMessage[],
  incoming: GlobalChatMessage[],
): GlobalChatMessage[] {
  const unique = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) unique.set(message.id, message);
  return [...unique.values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}
