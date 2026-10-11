import { object, text, uuid } from './validation.ts';
export type FriendMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};
export function chatInput(input: unknown) {
  const data = object(input);
  return { friendId: uuid(data.friendId), content: text(data.content, 'Mensaje', 500) };
}
export function missingChatTable(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}
export function mergeMessages(
  previous: FriendMessage[],
  incoming: FriendMessage[],
): FriendMessage[] {
  const unique = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) unique.set(message.id, message);
  return [...unique.values()]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .slice(-50);
}
