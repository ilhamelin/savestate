import 'server-only';
import { authenticatedAdmin } from '@/lib/session';
import { AppError, dbCheck } from '@/lib/http';
import { uuid } from '@/domain/validation';
import { operatorSignalInput } from '@/domain/operator-signals';
import { guardianAdminClient } from '@/services/guardian-admin';

export async function sendOperatorSignal(
  targetId: string,
  event: 'operator_kick' | 'operator_whisper',
  raw?: unknown,
) {
  const admin = await authenticatedAdmin();
  const id = uuid(targetId).toLowerCase();
  if (event === 'operator_kick' && id === admin.id)
    throw new AppError('Inmunidad de Operador: no puedes desconectarte.', 403);
  const message = event === 'operator_whisper' ? operatorSignalInput(raw).message : null;
  const db = guardianAdminClient();
  const target = await db.from('profiles').select('id').eq('id', id).maybeSingle();
  dbCheck(target.error);
  if (!target.data) throw new AppError('Jugador no encontrado.', 404);
  const result = await db.rpc('guardian_operator_signal', {
    p_target_id: id,
    p_actor: admin.id,
    p_event: event,
    p_message: message,
  });
  dbCheck(result.error);
  return { sent: result.data === true };
}
