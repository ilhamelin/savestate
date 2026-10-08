import 'server-only';
import { authenticated } from '@/lib/session';
import { object, uuid, text, reaction } from '@/domain/validation';
import { AppError, dbCheck } from '@/lib/http';
export async function communityMutation(input: unknown) {
  const { db, user } = await authenticated();
  const data = object(input);
  switch (data.action) {
    case 'reaction': {
      const { error } = await db.from('review_reactions').upsert(
        {
          user_id: user.id,
          review_id: uuid(data.review_id),
          reaction_type: reaction(data.reaction_type),
        },
        { onConflict: 'review_id,user_id' },
      );
      dbCheck(error);
      return true;
    }
    case 'unreact': {
      const { error } = await db
        .from('review_reactions')
        .delete()
        .eq('review_id', uuid(data.review_id))
        .eq('user_id', user.id);
      dbCheck(error);
      return true;
    }
    case 'comment': {
      const { error } = await db.from('review_comments').insert({
        review_id: uuid(data.review_id),
        user_id: user.id,
        content: text(data.content, 'Comentario', 2000),
      });
      dbCheck(error);
      return true;
    }
    case 'delete_comment': {
      const { error } = await db
        .from('review_comments')
        .delete()
        .eq('id', uuid(data.id))
        .eq('user_id', user.id);
      dbCheck(error);
      return true;
    }
    case 'report': {
      const { error } = await db.from('reports').insert({
        user_id: user.id,
        review_id: uuid(data.review_id),
        reason: text(data.reason, 'Motivo', 1000),
      });
      dbCheck(error);
      return true;
    }
    case 'suggest': {
      const { error } = await db.from('game_suggestions').insert({
        user_id: user.id,
        title: text(data.title, 'Título', 200),
        details: text(data.details, 'Detalles', 2000),
      });
      dbCheck(error);
      return true;
    }
    case 'read_notification': {
      const { error } = await db
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', uuid(data.id))
        .eq('user_id', user.id);
      dbCheck(error);
      return true;
    }
    case 'read_all_notifications': {
      const { error } = await db
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);
      dbCheck(error);
      return true;
    }
    case 'moderate_review': {
      const { data: claims } = await db.auth.getClaims();
      if (!['admin', 'moderator'].includes(claims?.claims.app_metadata?.role))
        throw new AppError('Acceso exclusivo de moderadores.', 403);
      const { error } = await db.from('reviews').delete().eq('id', uuid(data.review_id));
      dbCheck(error);
      return true;
    }
    default:
      throw new AppError('Operación comunitaria inválida.', 400);
  }
}
