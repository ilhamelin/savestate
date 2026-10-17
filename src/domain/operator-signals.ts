import { object, text, uuid } from './validation.ts';

export function operatorSignalInput(raw: unknown) {
  return { message: text(object(raw).message, 'Susurro', 140) };
}

export function operatorSignalPayload(raw: unknown, userId: string) {
  try {
    const value = object(raw);
    if (uuid(value.user_id) !== userId) return null;
    const sentAt = text(value.sent_at, 'Fecha', 64);
    const time = Date.parse(sentAt);
    if (!Number.isFinite(time) || Math.abs(Date.now() - time) > 120000) return null;
    return {
      id: uuid(value.id),
      userId,
      sender: text(value.sender, 'Operador', 80),
      message: value.message === undefined ? null : text(value.message, 'Susurro', 140),
    };
  } catch {
    return null;
  }
}
