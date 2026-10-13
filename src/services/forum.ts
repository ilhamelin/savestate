import 'server-only';
import { scheduleDiscordCheckpoint } from '@/services/discord';
import { serverClient } from '@/integrations/supabase/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { publicEnv } from '@/lib/env';
import { authenticated, currentUser } from '@/lib/session';
import { AppError, dbCheck } from '@/lib/http';
import { object, uuid } from '@/domain/validation';
import {
  FORUM_REACTIONS,
  FORUM_CATEGORIES,
  validateForumReplyEdit,
  forumText,
  forumReaction,
  forumSearch,
  forumSearchPattern,
  type ForumSort,
  validateForumReply,
  validateForumThread,
  type ForumAuthor,
  type ForumThread,
  type ForumThreadSummary,
  type ForumReplyView,
  type ForumReaction,
} from '@/domain/forum';
import { cleanMarkdown } from './markdown';
import { forumMarkdown } from './forum-markdown';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
type ForumDb = Awaited<ReturnType<typeof serverClient>>;

async function authors(ids: string[], suppliedDb?: ForumDb): Promise<ForumAuthor[]> {
  if (!ids.length) return [];
  const db = suppliedDb ?? (await serverClient());
  const [profiles, earned, catalogue] = await Promise.all([
    db
      .from('profiles')
      .select('id,username,avatar_url,terminal_status,room_theme,theme_color')
      .in('id', ids),
    db.from('user_badges').select('user_id,badge_id').in('user_id', ids).limit(1000),
    db.from('badges').select('id,name').limit(100),
  ]);
  [profiles, earned, catalogue].forEach((r) => dbCheck(r.error));
  return (profiles.data ?? []).map((p) => ({
    ...p,
    badges: (earned.data ?? [])
      .filter((b) => b.user_id === p.id)
      .map((b) => catalogue.data?.find((c) => c.id === b.badge_id)?.name ?? b.badge_id),
  }));
}
async function enrich(
  rows: (ForumThread & { forum_replies?: { user_id: string; created_at: string }[] })[],
  suppliedDb?: ForumDb,
): Promise<ForumThreadSummary[]> {
  const db = suppliedDb ?? (await serverClient()),
    ids = [...new Set(rows.flatMap((r) => (r.game_id ? [r.game_id] : [])))];
  const [players, games] = await Promise.all([
    authors(
      [
        ...new Set(
          rows.flatMap((r) => [
            r.user_id,
            ...(r.forum_replies ?? []).map((reply) => reply.user_id),
          ]),
        ),
      ],
      db,
    ),
    ids.length
      ? db.from('games').select('id,title,slug,cover_url').in('id', ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  dbCheck(games.error);
  return rows.map((r) => ({
    ...r,
    author: players.find((p) => p.id === r.user_id) ?? null,
    game: games.data?.find((g) => g.id === r.game_id) ?? null,
    lastAuthor: players.find((p) => p.id === r.forum_replies?.[0]?.user_id) ?? null,
  }));
}
// Anonymous, public data only. No cookies or viewer-dependent values enter this cache.
const cachedDirectory = unstable_cache(
  async (projectUrl: string, search: string, sort: ForumSort, category: string) => {
    const db = createClient<Database>(projectUrl, publicEnv().key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let threads = db
      .from('forum_threads')
      .select('*,forum_replies(user_id,created_at)')
      .order('created_at', { referencedTable: 'forum_replies', ascending: false })
      .order('id', { referencedTable: 'forum_replies', ascending: false })
      .limit(1, { referencedTable: 'forum_replies' });
    if (FORUM_CATEGORIES.includes(category as (typeof FORUM_CATEGORIES)[number]))
      threads = threads.eq('category_id', category);
    if (search) threads = threads.ilike('title', forumSearchPattern(search));
    if (sort === 'unanswered') threads = threads.eq('replies_count', 0);
    if (sort === 'active') threads = threads.order('replies_count', { ascending: false });
    const [categories, stats, hot] = await Promise.all([
      db.from('forum_categories').select('*').order('sort_order'),
      db.rpc('forum_category_stats'),
      threads
        .order('last_reply_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(search ? 24 : 15),
    ]);
    [categories, stats, hot].forEach((r) => dbCheck(r.error));
    return {
      categories: categories.data ?? [],
      stats: stats.data ?? [],
      hot: await enrich(hot.data ?? [], db),
    };
  },
  ['forum-directory-v3'],
  { revalidate: 30, tags: ['forum-directory'] },
);
export async function forumDirectory(search = '', sort: ForumSort = 'recent', category = '') {
  return cachedDirectory(publicEnv().url, forumSearch(search), sort, category);
}
export async function forumCategories() {
  const result = await (
    await serverClient()
  )
    .from('forum_categories')
    .select('*')
    .order('sort_order');
  dbCheck(result.error);
  return result.data ?? [];
}
export async function forumThreads(
  category: string,
  page: number,
  game?: string,
  sort: ForumSort = 'recent',
  search = '',
) {
  const db = await serverClient();
  let query = db
    .from('forum_threads')
    .select('*,forum_replies(user_id,created_at)', { count: 'exact' })
    .order('created_at', { referencedTable: 'forum_replies', ascending: false })
    .order('id', { referencedTable: 'forum_replies', ascending: false })
    .limit(1, { referencedTable: 'forum_replies' })
    .eq('category_id', category)
    .order('is_pinned', { ascending: false });
  if (forumSearch(search)) query = query.ilike('title', forumSearchPattern(forumSearch(search)));
  if (sort === 'unanswered') query = query.eq('replies_count', 0);
  if (sort === 'active') query = query.order('replies_count', { ascending: false });
  query = query.order('last_reply_at', { ascending: false }).order('id', { ascending: false });
  if (game) query = query.eq('game_id', uuid(game));
  const result = await query.range((page - 1) * 20, page * 20 - 1);
  dbCheck(result.error);
  return { threads: await enrich(result.data ?? []), total: result.count ?? 0 };
}
export async function gameForumThreads(gameId: string) {
  const db = await serverClient();
  const result = await db
    .from('forum_threads')
    .select('*')
    .eq('game_id', gameId)
    .order('last_reply_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(5);
  dbCheck(result.error);
  return enrich(result.data ?? []);
}
export async function forumConversation(category: string, id: string, page: number) {
  const db = await serverClient(),
    viewer = await currentUser();
  const thread = await db
    .from('forum_threads')
    .select('*')
    .eq('id', uuid(id))
    .eq('category_id', category)
    .maybeSingle();
  dbCheck(thread.error);
  if (!thread.data) return null;
  const result = await db
    .from('forum_replies')
    .select('*', { count: 'exact' })
    .eq('thread_id', id)
    .order('created_at')
    .order('id')
    .range((page - 1) * 20, page * 20 - 1);
  dbCheck(result.error);
  const rows = result.data ?? [],
    quoteIds = [...new Set(rows.flatMap((r) => (r.reply_to_id ? [r.reply_to_id] : [])))];
  const quotes = quoteIds.length
    ? await db
        .from('forum_replies')
        .select('id,user_id,content')
        .in('id', quoteIds)
        .eq('thread_id', id)
    : { data: [], error: null };
  dbCheck(quotes.error);
  const players = await authors([
    ...new Set([
      thread.data.user_id,
      ...rows.map((r) => r.user_id),
      ...(quotes.data ?? []).map((r) => r.user_id),
    ]),
  ]);
  const reactions: ForumReaction[] = [];
  if (rows.length)
    for (let offset = 0; ; offset += 1000) {
      const batch = await db
        .from('forum_reactions')
        .select('*')
        .in(
          'reply_id',
          rows.map((r) => r.id),
        )
        .order('reply_id')
        .order('user_id')
        .range(offset, offset + 999);
      dbCheck(batch.error);
      reactions.push(...(batch.data ?? []));
      if ((batch.data?.length ?? 0) < 1000) break;
    }
  const replies: ForumReplyView[] = rows.map((r) => {
    const quote = quotes.data?.find((q) => q.id === r.reply_to_id);
    return {
      ...r,
      author: players.find((p) => p.id === r.user_id) ?? null,
      html: forumMarkdown(r.content),
      quote: quote
        ? {
            username: players.find((p) => p.id === quote.user_id)?.username ?? 'jugador',
            html: forumMarkdown(quote.content),
          }
        : null,
      ownReaction:
        reactions.find((v) => v.reply_id === r.id && v.user_id === viewer?.id)?.reaction_type ??
        null,
      counts: Object.fromEntries(
        FORUM_REACTIONS.map((type) => [
          type,
          reactions.filter((v) => v.reply_id === r.id && v.reaction_type === type).length,
        ]),
      ) as ForumReplyView['counts'],
    };
  });
  return {
    thread: (await enrich([thread.data]))[0]!,
    html: forumMarkdown(thread.data.content),
    replies,
    total: result.count ?? 0,
    viewerId: viewer?.id ?? null,
  };
}
export async function forumMutation(input: unknown) {
  const data = object(input);
  if (data.action === 'view') {
    const db = await serverClient();
    const result = await db.rpc('increment_thread_views', { p_thread_id: uuid(data.thread_id) });
    dbCheck(result.error);
    return true;
  }
  const { db, user } = await authenticated();
  if (data.action === 'preview')
    return { html: forumMarkdown(forumText(data.content, 'Mensaje', 10000)) };
  if (data.action === 'create') {
    const validated = validateForumThread(data),
      content = cleanMarkdown(validated.content);
    validateForumThread({ ...validated, content });
    const result = await db
      .from('forum_threads')
      .insert({ ...validated, content, user_id: user.id })
      .select('id,category_id')
      .single();
    dbCheck(result.error);
    revalidatePath('/forum');
    revalidateTag('forum-directory', { expire: 0 });
    if (process.env.DISCORD_WEBHOOK_URL) {
      const profile = await db.from('profiles').select('username').eq('id', user.id).maybeSingle();
      if (!profile.error && profile.data)
        scheduleDiscordCheckpoint({
          type: 'forum',
          username: profile.data.username,
          details: `abrió «${validated.title}» en #${validated.category_id}.`,
          path: `/forum/${encodeURIComponent(result.data!.category_id)}/${result.data!.id}`,
        });
    }
    return result.data;
  }
  if (data.action === 'reply') {
    const validated = validateForumReply(data),
      content = cleanMarkdown(validated.content);
    validateForumReply({ ...validated, content });
    const result = await db
      .from('forum_replies')
      .insert({ ...validated, content, user_id: user.id })
      .select('id')
      .single();
    dbCheck(result.error);
    revalidatePath('/forum');
    revalidateTag('forum-directory', { expire: 0 });
    return result.data;
  }
  if (data.action === 'edit_reply' || data.action === 'delete_reply') {
    const validated =
      data.action === 'edit_reply'
        ? validateForumReplyEdit(data)
        : { reply_id: uuid(data.reply_id), content: '' };
    const reply = await db
      .from('forum_replies')
      .select('thread_id')
      .eq('id', validated.reply_id)
      .eq('user_id', user.id)
      .maybeSingle();
    dbCheck(reply.error);
    if (!reply.data) throw new AppError('No existe una respuesta propia con ese ID.', 404);
    const parent = await db
      .from('forum_threads')
      .select('is_locked,category_id')
      .eq('id', reply.data.thread_id)
      .maybeSingle();
    dbCheck(parent.error);
    if (!parent.data || parent.data.is_locked) throw new AppError('Este hilo está cerrado.', 409);
    let result;
    if (data.action === 'edit_reply') {
      const content = cleanMarkdown(validated.content);
      validateForumReplyEdit({ ...validated, content });
      // SQL forum_reply_touch sets updated_at; authenticated may update only content.
      result = await db
        .from('forum_replies')
        .update({ content })
        .eq('id', validated.reply_id)
        .eq('user_id', user.id)
        .select('id')
        .single();
    } else
      result = await db
        .from('forum_replies')
        .delete()
        .eq('id', validated.reply_id)
        .eq('user_id', user.id)
        .select('id')
        .single();
    dbCheck(result.error);
    revalidatePath('/forum');
    revalidatePath('/forum/' + parent.data.category_id);
    revalidatePath('/forum/' + parent.data.category_id + '/' + reply.data.thread_id);
    revalidateTag('forum-directory', { expire: 0 });
    return result.data;
  }
  if (data.action === 'reaction') {
    const id = uuid(data.reply_id),
      type = forumReaction(data.reaction_type);
    const previous = await db
      .from('forum_reactions')
      .select('reaction_type')
      .eq('reply_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    dbCheck(previous.error);
    const result =
      previous.data?.reaction_type === type
        ? await db.from('forum_reactions').delete().eq('reply_id', id).eq('user_id', user.id)
        : previous.data
          ? await db
              .from('forum_reactions')
              .update({ reaction_type: type })
              .eq('reply_id', id)
              .eq('user_id', user.id)
          : await db
              .from('forum_reactions')
              .insert({ reply_id: id, user_id: user.id, reaction_type: type });
    dbCheck(result.error);
    return true;
  }
  throw new AppError('Operación del foro inválida.', 400);
}
