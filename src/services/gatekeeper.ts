import 'server-only';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { gateSecretBytes } from '@/domain/gatekeeper';
import { AppError } from '@/lib/http';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/lib/database.types';
import { auditSecurityEvent } from '@/services/guardian-admin';

export async function auditGatekeeperFailure(request: Request, secret: string) {
  const ip = process.env.VERCEL
    ? (request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown')
    : 'local';
  const keyHash = createHmac('sha256', secret).update(`gatekeeper:ip:${ip}`).digest('hex');
  await auditSecurityEvent('gatekeeper_invalid_code', {}, keyHash);
}

export function configuredGateSecret() {
  const secret = process.env.GATEKEEPER_SECRET ?? '';
  try {
    gateSecretBytes(secret);
  } catch {
    throw new AppError('Guardian requiere configurar GATEKEEPER_SECRET en el servidor.', 503);
  }
  return secret;
}
export async function claimGatekeeperAttempt(request: Request, secret: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey)
    throw new AppError('El control de intentos de Guardian no está configurado.', 503);
  const ip = process.env.VERCEL
    ? (request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown')
    : 'local';
  const keyHash = createHmac('sha256', secret).update(`gatekeeper:ip:${ip}`).digest('hex');
  // Privileged client is limited to the anonymous attempt limiter; no user data is read here.
  const db = createClient<Database>(publicEnv().url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc('claim_gatekeeper_attempt', { p_key_hash: keyHash });
  if (error) throw new AppError('Aplica la migración 035 antes de activar Gatekeeper.', 503);
  if (!data) throw new AppError('Demasiados intentos. Espera un minuto antes de reintentar.', 429);
}
