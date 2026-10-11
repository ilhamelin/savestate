import 'server-only';
import { authenticated } from '@/lib/session';
import { AppError, dbCheck } from '@/lib/http';
import { uuid } from '@/domain/validation';
import { chatInput, missingChatTable } from '@/domain/friend-chat';
async function chatSession(friendId: unknown) {
  const { user, db } = await authenticated();
  const id = uuid(friendId);
  if (id === user.id) throw new AppError('Selecciona un amigo.', 400);
  const friendship = await db
    .from('friendships')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${user.id})`,
    )
    .limit(1);
  dbCheck(friendship.error);
  if (!friendship.data?.length)
    throw new AppError('Solo puedes chatear con amistades aceptadas.', 403);
  return { user, db, friendId: id };
}
export async function friendHistory(friendId: unknown) {
  const { user, db, friendId: id } = await chatSession(friendId);
  const result = await db
    .from('friend_messages')
    .select('*')
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${user.id})`,
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(50);
  if (missingChatTable(result.error)) return { messages: [], persisted: false };
  dbCheck(result.error);
  return { messages: (result.data ?? []).reverse(), persisted: true };
}
export async function sendFriendMessage(input: unknown) {
  const data = chatInput(input);
  const { user, db, friendId } = await chatSession(data.friendId);
  const result = await db
    .from('friend_messages')
    .insert({ sender_id: user.id, receiver_id: friendId, content: data.content })
    .select('*')
    .single();
  // Do not report successful delivery while the private channel policies are absent.
  if (missingChatTable(result.error))
    throw new AppError('El chat requiere aplicar la migración 026. No se envió el mensaje.', 503);
  dbCheck(result.error);
  return { message: result.data!, persisted: true };
}
