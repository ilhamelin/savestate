import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { publicEnv, isConfigured } from '@/lib/env';
import { AppError } from '@/lib/http';
import {
  DEFAULT_SYSTEM_SWITCHES,
  type SystemSwitches,
  type SystemBroadcast,
} from '@/domain/guardian-suite';

let cached: { value: SystemSwitches; until: number } | null = null;
let pending: Promise<SystemSwitches> | null = null;
export function clearSystemSwitchCache() {
  cached = null;
}
function reader() {
  const { url, key } = publicEnv();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function getSystemSwitches(): Promise<SystemSwitches> {
  const fallback = {
    ...DEFAULT_SYSTEM_SWITCHES,
    gatekeeper_enabled: process.env.GATEKEEPER_ENABLED === 'true',
  };
  if (!isConfigured()) return fallback;
  if (cached && cached.until > Date.now()) return cached.value;
  if (pending) return pending;
  pending = (async () => {
    const result = await reader()
      .from('system_switches')
      .select('key,value')
      .abortSignal(AbortSignal.timeout(3000));
    if (result.error)
      throw new AppError('No se pudieron consultar los interruptores del sistema.', 503);
    const value = { ...fallback };
    for (const row of result.data ?? []) {
      if (
        (row.key === 'gatekeeper_enabled' ||
          row.key === 'registrations_open' ||
          row.key === 'double_xp') &&
        typeof row.value === 'boolean'
      )
        value[row.key] = row.value;
      if (row.key === 'seasonal_theme' && (row.value === 'classic' || row.value === 'halloween'))
        value.seasonal_theme = row.value;
    }
    cached = { value, until: Date.now() + 10000 };
    return value;
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}
export async function getActiveSystemBroadcast(): Promise<SystemBroadcast | null> {
  if (!isConfigured()) return null;
  const result = await reader()
    .from('system_broadcasts')
    .select('id,message,category,created_at')
    .eq('active', true)
    .abortSignal(AbortSignal.timeout(3000))
    .maybeSingle();
  if (result.error) throw new AppError('No se pudo consultar el anuncio activo.', 503);
  return result.data;
}
