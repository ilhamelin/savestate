import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createHmac, createHash } from 'node:crypto';
import type { Database } from '@/lib/database.types';
import { publicEnv } from '@/lib/env';
import { AppError } from '@/lib/http';
import type {
  SupportTicketInput,
  SupportTicketRow,
  TelemetryErrorEvent,
} from '@/domain/support-ticket';

export interface SupportStore {
  save(input: SupportTicketInput, telemetryId?: string): Promise<SupportTicketRow>;
  claim(id: string): Promise<SupportTicketRow | null>;
  markSending(row: SupportTicketRow): Promise<SupportTicketRow>;
  finish(row: SupportTicketRow, patch: Partial<SupportTicketRow>): Promise<SupportTicketRow>;
  list(): Promise<SupportTicketRow[]>;
  pending(): Promise<SupportTicketRow[]>;
  record(event: TelemetryErrorEvent): Promise<string>;
  events(): Promise<TelemetryErrorEvent[]>;
}
function supportDb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new AppError(
      'El canal de soporte todavía no está configurado (falta SUPABASE_SERVICE_ROLE_KEY).',
      503,
    );
  // Scoped to support tables/RPCs; all Guardian reads authorize before reaching this store.
  return createClient<Database>(publicEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function check(error: { code?: string; message: string; details?: string } | null) {
  if (error) {
    console.error('Support store DB error:', error);
    const detail = error.code ? `[${error.code}] ${error.message}` : error.message;
    throw new AppError(
      `Soporte no disponible (${detail}). Comprueba la migración 040 o recarga el esquema.`,
      503,
    );
  }
}
export async function claimSupportAttempt(request: Request, kind: 'support' | 'telemetry') {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new AppError('El canal de soporte todavía no está configurado.', 503);
  // Vercel sets this header. Never trust arbitrary x-forwarded-for outside that platform.
  const ip = process.env.VERCEL
    ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    : 'local';
  const hash = createHmac('sha256', key)
    .update('support:' + kind + ':' + ip)
    .digest('hex');
  const result = await supportDb().rpc('claim_support_attempt', { p_key_hash: hash, p_kind: kind });
  check(result.error);
  if (!result.data) throw new AppError('Demasiados reportes. Espera 10 minutos.', 429);
}
export const supportStore: SupportStore = {
  async save(input, telemetryId) {
    const db = supportDb();
    if (telemetryId) {
      const prior = await db
        .from('support_tickets')
        .select('*')
        .eq('telemetry_id', telemetryId)
        .maybeSingle();
      check(prior.error);
      if (prior.data) return prior.data;
    }
    const result = await db
      .from('support_tickets')
      .insert({
        input,
        telemetry_id: telemetryId ?? null,
      })
      .select('*')
      .single();
    if (result.error?.code === '23505' && telemetryId) {
      const prior = await db
        .from('support_tickets')
        .select('*')
        .eq('telemetry_id', telemetryId)
        .single();
      check(prior.error);
      return prior.data!;
    }
    check(result.error);
    if (!result.data) throw new AppError('No se pudo guardar el reporte.', 503);
    return result.data;
  },
  async claim(id) {
    const result = await supportDb().rpc('claim_support_ticket', { p_id: id });
    check(result.error);
    return result.data?.[0] ?? null;
  },
  async markSending(row) {
    const result = await supportDb()
      .from('support_tickets')
      .update({ status: 'sending' })
      .eq('id', row.id)
      .eq('lease_token', row.lease_token!)
      .select('*')
      .single();
    check(result.error);
    if (!result.data) throw new AppError('El reporte está siendo procesado.', 503);
    return result.data;
  },
  async finish(row, patch) {
    const result = await supportDb()
      .from('support_tickets')
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
        locked_until: null,
        lease_token: null,
        next_attempt_at: new Date(Date.now() + 3600000).toISOString(),
      })
      .eq('id', row.id)
      .eq('lease_token', row.lease_token!)
      .select('*')
      .single();
    check(result.error);
    if (!result.data) throw new AppError('El reporte sigue en proceso de conciliación.', 503);
    return result.data;
  },
  async list() {
    const result = await supportDb()
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    check(result.error);
    return result.data ?? [];
  },
  async pending() {
    const result = await supportDb()
      .from('support_tickets')
      .select('*')
      .neq('status', 'synced_jira')
      .lte('next_attempt_at', new Date().toISOString())
      .order('next_attempt_at', { ascending: true })
      .limit(3);
    check(result.error);
    return result.data ?? [];
  },
  async record(event) {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([event.message, event.pathname, event.stack ?? '']))
      .digest('hex');
    const result = await supportDb().rpc('record_support_telemetry', {
      p_event: event,
      p_fingerprint: fingerprint,
    });
    check(result.error);
    return result.data!;
  },
  async events() {
    const result = await supportDb()
      .from('support_telemetry')
      .select('event')
      .order('created_at', { ascending: false })
      .limit(50);
    check(result.error);
    return (result.data ?? []).map((row) => row.event);
  },
};
