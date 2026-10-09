import 'server-only';
import { authenticated } from '@/lib/session';
import { dbCheck, AppError } from '@/lib/http';
import {
  object,
  uuid,
  status,
  rating,
  favorites,
  validatePlayLog,
  text,
  bool,
} from '@/domain/validation';
import { cleanMarkdown, renderMarkdown } from '@/services/markdown';
import { sessionMinutes, accumulatedHours } from '@/domain/quick-session';
import { favoriteSlot, favoriteGame } from '@/domain/top4';
import { revalidatePath } from 'next/cache';
import { grantXp, grantCompletionXp, grantSessionXp } from '@/services/progression';
export async function libraryMutation(input: unknown) {
  const { db, user } = await authenticated();
  const data = object(input);
  switch (data.action) {
    case 'favorite_slot': {
      const { error } = await db.rpc('set_favorite_slot', {
        p_slot: favoriteSlot(data.slot),
        p_game_id: favoriteGame(data.game_id),
        p_status: 'backlog',
      });
      dbCheck(error);
      revalidatePath('/players/[username]', 'page');
      revalidatePath('/library');
      return true;
    }
    case 'preview_review': {
      return renderMarkdown(text(data.content, 'Reseña', 10000));
    }
    case 'quick_session': {
      const id = uuid(data.id),
        minutes = sessionMinutes(data.minutes);
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: log, error: readError } = await db
          .from('play_logs')
          .select('id,user_game_id,hours_played')
          .eq('id', id)
          .maybeSingle();
        dbCheck(readError);
        if (!log) throw new AppError('Partida no encontrada.', 404);
        const { data: owner, error: ownerError } = await db
          .from('user_games')
          .select('id')
          .eq('id', log.user_game_id)
          .eq('user_id', user.id)
          .maybeSingle();
        dbCheck(ownerError);
        if (!owner) throw new AppError('Partida no encontrada.', 404);
        const { data: updated, error } = await db
          .from('play_logs')
          .update({ hours_played: accumulatedHours(Number(log.hours_played), minutes) })
          .eq('id', id)
          .eq('user_game_id', owner.id)
          .eq('hours_played', log.hours_played)
          .select()
          .maybeSingle();
        dbCheck(error);
        if (updated) {
          await grantSessionXp(
            db,
            user.id,
            updated.user_game_id,
            updated.id,
            Number(updated.hours_played),
          );
          return updated;
        }
      }
      throw new AppError(
        'La partida cambió mientras guardabas. Revisa sus horas antes de volver a intentarlo.',
        409,
      );
    }
    case 'add': {
      const gameId = uuid(data.game_id);
      const selectedStatus = status(data.status);
      if (!['backlog', 'wishlist', 'playing'].includes(selectedStatus))
        throw new AppError('Estado de agregado inválido.', 400);
      const { data: row, error } = await db
        .from('user_games')
        .upsert(
          { user_id: user.id, game_id: gameId, status: selectedStatus },
          { onConflict: 'user_id,game_id', ignoreDuplicates: true },
        )
        .select()
        .maybeSingle();
      dbCheck(error);
      if (row) return row;
      const { data: existing, error: readError } = await db
        .from('user_games')
        .select()
        .eq('user_id', user.id)
        .eq('game_id', gameId)
        .single();
      dbCheck(readError);
      return existing;
    }
    case 'save': {
      const gameId = uuid(data.game_id);
      const changes = { status: status(data.status), rating: rating(data.rating) };
      // Ownership columns cannot be updated. Insert first without modifying conflicts,
      // then update only the editable columns when the library record already exists.
      const { data: inserted, error: insertError } = await db
        .from('user_games')
        .upsert(
          {
            user_id: user.id,
            game_id: gameId,
            ...changes,
          },
          { onConflict: 'user_id,game_id', ignoreDuplicates: true },
        )
        .select()
        .maybeSingle();
      dbCheck(insertError);
      if (inserted) {
        await grantCompletionXp(db, user.id, gameId);
        return inserted;
      }
      const { data: row, error } = await db
        .from('user_games')
        .update(changes)
        .eq('user_id', user.id)
        .eq('game_id', gameId)
        .select()
        .single();
      dbCheck(error);
      await grantCompletionXp(db, user.id, gameId);
      return row;
    }
    case 'delete': {
      const { data: rows, error } = await db
        .from('user_games')
        .delete()
        .eq('user_id', user.id)
        .eq('id', uuid(data.id))
        .select();
      dbCheck(error);
      if (!rows?.length) throw new AppError('Registro no encontrado.', 404);
      return rows[0];
    }
    case 'favorites': {
      const { error } = await db.rpc('set_favorites', { p_game_ids: favorites(data.game_ids) });
      dbCheck(error);
      return true;
    }
    case 'log': {
      const log = validatePlayLog(data);
      const previous = data.id
        ? await db.from('play_logs').select('hours_played').eq('id', uuid(data.id)).single()
        : null;
      if (previous) dbCheck(previous.error);
      const { data: row, error } = data.id
        ? await db.from('play_logs').update(log).eq('id', uuid(data.id)).select().single()
        : await db.from('play_logs').insert(log).select().single();
      dbCheck(error);
      if (row && Number(row.hours_played) > Number(previous?.data?.hours_played ?? 0))
        await grantSessionXp(db, user.id, row.user_game_id, row.id, Number(row.hours_played));
      return row;
    }
    case 'delete_log': {
      const { data: rows, error } = await db
        .from('play_logs')
        .delete()
        .eq('id', uuid(data.id))
        .select();
      dbCheck(error);
      if (!rows?.length) throw new AppError('Partida no encontrada.', 404);
      return true;
    }
    case 'review': {
      const markdown = cleanMarkdown(text(data.content, 'Reseña', 10000));
      const html = renderMarkdown(markdown);
      if (!html.trim()) throw new AppError('La reseña no puede estar vacía.', 400);
      const { data: id, error } = await db.rpc('save_review', {
        p_game_id: uuid(data.game_id),
        p_rating: rating(data.rating, true)!,
        p_content: html,
        p_markdown: markdown,
        p_has_spoilers: bool(data.has_spoilers, 'Spoilers'),
      });
      dbCheck(error);
      if (markdown.trim().length >= 100) await grantXp(user.id, 75, 'review', uuid(data.game_id));
      return id;
    }
    case 'delete_review': {
      const { data: rows, error } = await db
        .from('reviews')
        .delete()
        .eq('id', uuid(data.id))
        .select();
      dbCheck(error);
      if (!rows?.length) throw new AppError('Reseña no encontrada.', 404);
      return true;
    }
    default:
      throw new AppError('Operación de biblioteca inválida.', 400);
  }
}
