import { object, text, uuid, ValidationError } from './validation.ts';
import type { Profile } from './model.ts';
export const FORUM_CATEGORIES = [
  'retro-corner',
  'general-gaming',
  'guides-secrets',
  'indie-sanctuary',
  'off-topic',
] as const;
const channels = {
  'retro-corner': { name: 'La Taberna Retro', theme: 'taberna' },
  'general-gaming': { name: 'Actualidad y Debate', theme: 'debate' },
  'guides-secrets': { name: 'Guías, Trucos y Secretos', theme: 'guias' },
  'indie-sanctuary': { name: 'El Rincón Indie', theme: 'indie' },
  'off-topic': { name: 'Zona de Descanso (Off-Topic)', theme: 'offtopic' },
} as const;
export function forumChannel(id: string) {
  return Object.hasOwn(channels, id) ? channels[id as keyof typeof channels] : null;
}
export const FORUM_SORTS = ['recent', 'active', 'unanswered'] as const;
export type ForumSort = (typeof FORUM_SORTS)[number];
export function forumSearch(input: unknown) {
  return typeof input === 'string'
    ? [...input]
        .map((character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character,
        )
        .join('')
        .trim()
        .slice(0, 100)
    : '';
}
export function forumSearchPattern(query: string) {
  return `%${query.replace(/[\\%_]/g, '\\$&')}%`;
}
export const FORUM_REACTIONS = ['like', 'gg', 'mind_blown', 'game_over'] as const;
export type ForumReactionType = (typeof FORUM_REACTIONS)[number];
export interface ForumCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
  created_at: string;
}
export interface ForumThread {
  id: string;
  category_id: string;
  user_id: string;
  game_id: string | null;
  title: string;
  content: string;
  is_pinned: boolean;
  is_locked: boolean;
  views_count: number;
  replies_count: number;
  last_reply_at: string;
  created_at: string;
  updated_at: string;
}
export interface ForumReply {
  id: string;
  thread_id: string;
  user_id: string;
  reply_to_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}
export interface ForumReaction {
  reply_id: string;
  user_id: string;
  reaction_type: ForumReactionType;
}
export type ForumAuthor = Pick<
  Profile,
  'id' | 'username' | 'avatar_url' | 'terminal_status' | 'room_theme' | 'theme_color'
> & { badges: string[] };
export type ForumThreadSummary = ForumThread & {
  author: ForumAuthor | null;
  game: { title: string; slug: string; cover_url?: string | null } | null;
  lastAuthor: ForumAuthor | null;
};
export type ForumReplyView = ForumReply & {
  author: ForumAuthor | null;
  html: string;
  quote: { username: string; html: string } | null;
  ownReaction: ForumReactionType | null;
  counts: Record<ForumReactionType, number>;
};
export function forumCategory(input: unknown) {
  if (!FORUM_CATEGORIES.includes(input as (typeof FORUM_CATEGORIES)[number]))
    throw new ValidationError('Canal inválido.');
  return input as (typeof FORUM_CATEGORIES)[number];
}
export function forumPage(input: unknown) {
  if (input === undefined || input === null) return 1;
  const value = Number(input);
  if (!Number.isInteger(value) || value < 1 || value > 10000)
    throw new ValidationError('Página inválida.');
  return value;
}
export function forumText(input: unknown, label: string, max: number, min = 1) {
  const value = text(input, label, max * 2, min);
  if ([...value].length > max || [...value].length < min)
    throw new ValidationError(`${label}: entre ${min} y ${max} caracteres.`);
  return value;
}
export function validateForumThread(input: unknown) {
  const data = object(input);
  return {
    category_id: forumCategory(data.category_id),
    title: forumText(data.title, 'Título', 150, 3),
    content: forumText(data.content, 'Mensaje', 10000, 5),
    game_id: data.game_id ? uuid(data.game_id) : null,
  };
}
export function validateForumReply(input: unknown) {
  const data = object(input);
  return {
    thread_id: uuid(data.thread_id),
    reply_to_id: data.reply_to_id ? uuid(data.reply_to_id) : null,
    content: forumText(data.content, 'Respuesta', 8000),
  };
}
export function forumReaction(input: unknown): ForumReactionType {
  if (!FORUM_REACTIONS.includes(input as ForumReactionType))
    throw new ValidationError('Reacción inválida.');
  return input as ForumReactionType;
}

export function extractForumExcerpt(markdown: string, maxLength = 150) {
  const hasSpoilers = /\|\|[^\n]+?\|\|/.test(markdown);
  const hasCode = /```[\s\S]*?```/.test(markdown);
  const cleaned = markdown
    .replace(/```[\s\S]*?```/g, ' [Código] ')
    .replace(/\|\|[\s\S]*?\|\|/g, ' [Spoiler] ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#>*_`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const limit = Number.isFinite(maxLength) ? Math.max(0, Math.floor(maxLength)) : 150;
  const chars = Array.from(cleaned);
  let excerpt = cleaned;
  if (chars.length > limit) {
    let prefix = chars
      .slice(0, Math.max(0, limit - 1))
      .join('')
      .trimEnd();
    const boundary = prefix.lastIndexOf(' ');
    if (boundary > prefix.length * 0.65) prefix = prefix.slice(0, boundary);
    excerpt = limit ? prefix + '…' : '';
  }
  return { excerpt, hasSpoilers, hasCode };
}
export function validateForumReplyEdit(input: unknown) {
  const data = object(input);
  return { reply_id: uuid(data.reply_id), content: forumText(data.content, 'Respuesta', 8000) };
}
export function optimisticForumReaction(
  reply: ForumReplyView,
  type: ForumReactionType,
): ForumReplyView {
  const counts = { ...reply.counts };
  if (reply.ownReaction) counts[reply.ownReaction] = Math.max(0, counts[reply.ownReaction] - 1);
  const ownReaction = reply.ownReaction === type ? null : type;
  if (ownReaction) counts[ownReaction]++;
  return { ...reply, counts, ownReaction };
}
