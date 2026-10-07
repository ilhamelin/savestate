import 'server-only';
import { authenticated } from '@/lib/session';
import { object, uuid, text, bool } from '@/domain/validation';
import { AppError, dbCheck } from '@/lib/http';
export async function listMutation(input: unknown) {
  const { db, user } = await authenticated();
  const data = object(input);
  switch (data.action) {
    case 'save': {
      const list = {
        title: text(data.title, 'Título', 120),
        description: text(data.description ?? '', 'Descripción', 2000, 0),
        is_private: bool(data.is_private, 'Privacidad'),
      };
      const { data: row, error } = data.id
        ? await db
            .from('user_lists')
            .update(list)
            .eq('id', uuid(data.id))
            .eq('user_id', user.id)
            .select()
            .single()
        : await db
            .from('user_lists')
            .insert({ ...list, user_id: user.id })
            .select()
            .single();
      dbCheck(error);
      return row;
    }
    case 'delete': {
      const { error } = await db
        .from('user_lists')
        .delete()
        .eq('id', uuid(data.id))
        .eq('user_id', user.id);
      dbCheck(error);
      return true;
    }
    case 'item': {
      if (
        !Number.isInteger(data.position_index) ||
        Number(data.position_index) < 0 ||
        Number(data.position_index) > 10000
      )
        throw new AppError('Posición inválida.', 400);
      const { data: row, error } = await db
        .from('list_items')
        .upsert(
          {
            list_id: uuid(data.list_id),
            game_id: uuid(data.game_id),
            position_index: Number(data.position_index),
            note: text(data.note ?? '', 'Nota', 1000, 0),
          },
          { onConflict: 'list_id,game_id' },
        )
        .select()
        .single();
      dbCheck(error);
      return row;
    }
    case 'remove_item': {
      const { error } = await db.from('list_items').delete().eq('id', uuid(data.id));
      dbCheck(error);
      return true;
    }
    default:
      throw new AppError('Operación de lista inválida.', 400);
  }
}
