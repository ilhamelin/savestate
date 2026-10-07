import 'server-only';
import { authenticated } from '@/lib/session';
import { object, uuid } from '@/domain/validation';
import { AppError, dbCheck } from '@/lib/http';
export async function socialMutation(input: unknown) {
  const { db, user } = await authenticated();
  const data = object(input);
  switch (data.action) {
    case 'follow': {
      const target = uuid(data.user_id);
      if (target === user.id) throw new AppError('No puedes seguirte a ti mismo.', 400);
      const { error } = await db
        .from('follows')
        .upsert(
          { follower_id: user.id, followed_id: target },
          { onConflict: 'follower_id,followed_id', ignoreDuplicates: true },
        );
      dbCheck(error);
      return true;
    }
    case 'unfollow': {
      const { error } = await db
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followed_id', uuid(data.user_id));
      dbCheck(error);
      return true;
    }
    case 'request': {
      const target = uuid(data.user_id);
      if (target === user.id) throw new AppError('No puedes enviarte una solicitud.', 400);
      const { data: row, error } = await db
        .from('friendships')
        .insert({ sender_id: user.id, receiver_id: target, status: 'pending' })
        .select()
        .single();
      dbCheck(error);
      return row;
    }
    case 'respond': {
      if (!['accepted', 'rejected'].includes(String(data.status)))
        throw new AppError('Respuesta inválida.', 400);
      const { data: row, error } = await db
        .from('friendships')
        .update({ status: data.status as 'accepted' | 'rejected' })
        .eq('id', uuid(data.id))
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .select()
        .maybeSingle();
      dbCheck(error);
      if (!row) throw new AppError('Solicitud no encontrada.', 404);
      return row;
    }
    case 'remove': {
      const { data: rows, error } = await db
        .from('friendships')
        .delete()
        .eq('id', uuid(data.id))
        .select();
      dbCheck(error);
      if (!rows?.length) throw new AppError('Relación no encontrada.', 404);
      return true;
    }
    default:
      throw new AppError('Operación social inválida.', 400);
  }
}
