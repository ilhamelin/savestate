import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { publicEnv } from '@/lib/env';
import { AppError } from '@/lib/http';

// Callers must authorize authenticatedAdmin before reading or mutating administrative data.
export function guardianAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new AppError('La configuración administrativa está incompleta.', 503);
  return createClient<Database>(publicEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function auditSecurityEvent(
  event: string,
  metadata: Record<string, unknown> = {},
  keyHash?: string,
) {
  try {
    const result = await guardianAdminClient()
      .from('security_audit_logs')
      .insert({ event, metadata, key_hash: keyHash ?? null });
    if (result.error) console.warn('Guardian audit unavailable', result.error.code);
  } catch {
    console.warn('Guardian audit unavailable');
  }
}
