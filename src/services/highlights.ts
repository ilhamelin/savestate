import 'server-only';
import { serverClient } from '@/integrations/supabase/server';
import { authenticated, currentUser } from '@/lib/session';
import { AppError, dbCheck } from '@/lib/http';
import { object, uuid, text, reaction } from '@/domain/validation';
import { validatePost, type PostCategory } from '@/domain/highlights';
import { REACTIONS } from '@/domain/model';
import { cleanMarkdown } from '@/services/markdown';
import { revalidatePath } from 'next/cache';
import { grantXp } from '@/services/progression';

export async function highlightMutation(input: unknown) {
  const { db, user } = await authenticated(),
    data = object(input);
  if (data.action === 'create' || data.action === 'update') {
    const editing = data.action === 'update';
    const existing = await db.from('posts').select('*').eq('id', uuid(data.id)).maybeSingle();
    dbCheck(existing.error);
    if (editing && (!existing.data || existing.data.user_id !== user.id))
      throw new AppError('Momento no encontrado.', 404);
    const post = validatePost(data, user.id);
    post.content = cleanMarkdown(post.content);
    if (!editing && existing.data) {
      const stored = existing.data;
      if (
        (Object.keys(post) as (keyof typeof post)[]).every(
          (key) => JSON.stringify(stored[key]) === JSON.stringify(post[key]),
        )
      ) {
        await grantXp(user.id, 40, 'highlight', stored.id);
        return { id: stored.id };
      }
      throw new AppError(
        'Este intento ya fue publicado con otros datos. Recarga para crear otro momento.',
        409,
      );
    }
    if (editing && data.expected_updated_at !== existing.data!.updated_at)
      throw new AppError(
        'Este momento cambió. Cancela y vuelve a editar para cargar la versión actual.',
        409,
      );
    if (post.game_id) {
      const result = await db.from('games').select('id').eq('id', post.game_id).maybeSingle();
      dbCheck(result.error);
      if (!result.data) throw new AppError('Juego no encontrado.', 404);
    }
    // Existence, ownership and metadata are checked using the user's Storage permissions.
    for (const path of post.image_urls) {
      const folder = path.slice(0, path.lastIndexOf('/')),
        filename = path.slice(path.lastIndexOf('/') + 1);
      const result = await db.storage
        .from('highlights')
        .list(folder, { search: filename, limit: 10 });
      dbCheck(result.error);
      const file = result.data?.find((file) => file.name === filename);
      if (
        !file ||
        file.metadata?.mimetype !== 'image/webp' ||
        !Number.isFinite(file.metadata?.size) ||
        file.metadata.size > 1048576 ||
        file.metadata.size <= 0
      )
        throw new AppError('Captura no encontrada o fuera de los límites.', 400);
    }
    if (editing) {
      const { id, user_id, ...changes } = post;
      const result = await db
        .from('posts')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user_id)
        .eq('updated_at', existing.data!.updated_at)
        .select('id');
      dbCheck(result.error);
      if (!result.data?.length)
        throw new AppError('Este momento cambió. Cancela y vuelve a editar.', 409);
      const removed = existing.data!.image_urls.filter((path) => !post.image_urls.includes(path));
      if (removed.length) {
        const cleanup = await db.storage
          .from('highlights')
          .remove(removed.filter((path) => path.startsWith(`${user.id}/${id}/`)));
        if (cleanup.error) console.error('Highlight storage cleanup failed');
      }
      revalidatePath('/highlights');
      return { id };
    }
    // can_view_post is STABLE and looks up the row; RETURNING can evaluate
    // its SELECT policy before that new row is visible in the statement snapshot.
    const result = await db.from('posts').insert(post);
    dbCheck(result.error);
    await grantXp(user.id, 40, 'highlight', post.id);
    return { id: post.id };
  }
  const id = uuid(data.post_id);
  const visible = await db.from('posts').select('id,user_id,image_urls').eq('id', id).maybeSingle();
  dbCheck(visible.error);
  if (!visible.data) throw new AppError('Momento no encontrado.', 404);
  if (data.action === 'reaction') {
    const type = reaction(data.reaction_type);
    const previous = await db
      .from('post_reactions')
      .select('reaction_type')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    dbCheck(previous.error);
    const result =
      previous.data?.reaction_type === type
        ? await db.from('post_reactions').delete().eq('post_id', id).eq('user_id', user.id)
        : await db
            .from('post_reactions')
            .upsert(
              { post_id: id, user_id: user.id, reaction_type: type },
              { onConflict: 'post_id,user_id' },
            );
    dbCheck(result.error);
    return true;
  }
  if (data.action === 'comment') {
    const result = await db
      .from('post_comments')
      .insert({ post_id: id, user_id: user.id, content: text(data.content, 'Comentario', 2000) });
    dbCheck(result.error);
    return true;
  }
  if (data.action === 'delete_comment') {
    const result = await db
      .from('post_comments')
      .delete()
      .eq('id', uuid(data.comment_id))
      .eq('post_id', id)
      .eq('user_id', user.id)
      .select('id');
    dbCheck(result.error);
    if (!result.data?.length) throw new AppError('Comentario no encontrado.', 404);
    return true;
  }
  if (data.action === 'delete') {
    if (visible.data.user_id !== user.id) throw new AppError('Momento no encontrado.', 404);
    const result = await db.from('posts').delete().eq('id', id).eq('user_id', user.id).select('id');
    dbCheck(result.error);
    if (!result.data?.length) throw new AppError('Momento no encontrado.', 404);
    if (visible.data.image_urls.length) {
      const removal = await db.storage
        .from('highlights')
        .remove(visible.data.image_urls.filter((path) => path.startsWith(`${user.id}/${id}/`)));
      if (removal.error) console.error('Highlight storage cleanup failed');
    }
    return true;
  }
  throw new AppError('Operación de momento inválida.', 400);
}

export async function highlightFeed(filters: {
  category?: PostCategory;
  player?: string;
  game?: string;
  post?: string;
  page: number;
  pageSize?: 6 | 12;
  mediaOnly?: boolean;
}) {
  const db = await serverClient(),
    viewer = await currentUser();
  let query = db
    .from('posts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.player) query = query.eq('user_id', uuid(filters.player));
  if (filters.game) query = query.eq('game_id', uuid(filters.game));
  if (filters.post) query = query.eq('id', uuid(filters.post));
  if (filters.mediaOnly) query = query.neq('media_type', 'none');
  const size = filters.pageSize ?? 12;
  const result = await query.range((filters.page - 1) * size, filters.page * size - 1);
  dbCheck(result.error);
  const posts = result.data ?? [];
  if (!posts.length) return { posts: [], total: result.count ?? 0 };
  const gameIds = [...new Set(posts.flatMap((p) => (p.game_id ? [p.game_id] : [])))];
  const [players, games] = await Promise.all([
    db
      .from('profiles')
      .select('id,username')
      .in('id', [...new Set(posts.map((p) => p.user_id))]),
    gameIds.length
      ? db.from('games').select('id,title,slug').in('id', gameIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  dbCheck(players.error);
  dbCheck(games.error);
  const enriched = await Promise.all(
    posts.map(async (post) => {
      const [images, own, ...counts] = await Promise.all([
        post.image_urls.length
          ? db.storage.from('highlights').createSignedUrls(post.image_urls, 300)
          : Promise.resolve({ data: [], error: null }),
        viewer
          ? db
              .from('post_reactions')
              .select('reaction_type')
              .eq('post_id', post.id)
              .eq('user_id', viewer.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        ...REACTIONS.map((type) =>
          db
            .from('post_reactions')
            .select('*', { head: true, count: 'exact' })
            .eq('post_id', post.id)
            .eq('reaction_type', type),
        ),
      ]);
      dbCheck(own.error);
      counts.forEach((count) => dbCheck(count.error));
      return {
        ...post,
        image_urls: viewer?.id === post.user_id ? post.image_urls : [],
        images: images.data?.flatMap((image) => (image.signedUrl ? [image.signedUrl] : [])) ?? [],
        mediaUnavailable: Boolean(images.error || images.data?.some((image) => image.error)),
        username: players.data?.find((p) => p.id === post.user_id)?.username ?? 'jugador',
        game: games.data?.find((g) => g.id === post.game_id) ?? null,
        ownReaction: own.data?.reaction_type ?? null,
        counts: Object.fromEntries(REACTIONS.map((type, i) => [type, counts[i]?.count ?? 0])),
      };
    }),
  );
  return { posts: enriched, total: result.count ?? 0 };
}
export async function highlightComments(postId: string, page: number) {
  const db = await serverClient(),
    id = uuid(postId);
  const visible = await db.from('posts').select('id').eq('id', id).maybeSingle();
  dbCheck(visible.error);
  if (!visible.data) throw new AppError('Momento no encontrado.', 404);
  const result = await db
    .from('post_comments')
    .select('*', { count: 'exact' })
    .eq('post_id', id)
    .order('created_at')
    .order('id')
    .range((page - 1) * 20, page * 20 - 1);
  dbCheck(result.error);
  const rows = result.data ?? [];
  const profiles = rows.length
    ? await db
        .from('profiles')
        .select('id,username')
        .in('id', [...new Set(rows.map((c) => c.user_id))])
    : { data: [], error: null };
  dbCheck(profiles.error);
  return {
    comments: rows.map((c) => ({
      ...c,
      username: profiles.data?.find((p) => p.id === c.user_id)?.username ?? 'jugador',
    })),
    total: result.count ?? 0,
  };
}
