import 'server-only';
import { createHmac } from 'node:crypto';
import { guardianAdminClient } from '@/services/guardian-admin';
import { isConfigured } from '@/lib/env';
import { dbCheck, AppError } from '@/lib/http';
import { object } from '@/domain/validation';
import { threatSnapshot, type ThreatShieldSnapshot, type ThreatSecurityEvent, type DefconLevel } from '@/domain/threat-shield';
export interface ThreatShieldStore {
  snapshot(): Promise<ThreatShieldSnapshot>;
  claimAuth(ip: string): Promise<boolean>;
  fail(ip: string, reason: string): Promise<{ quarantined: boolean; recentCount: number; expiresAt: number | null }>;
  quarantine(ip: string, action: 'block' | 'unblock', reason: string, actor: string): Promise<void>;
  defcon(level: DefconLevel, actor: string, reason: string): Promise<void>;
  telemetry(): Promise<{ snapshot: ThreatShieldSnapshot; attacksBlockedToday: number; events: ThreatSecurityEvent[] }>;
}
function requireData<T>(result: { data: T | null; error: { code?: string; message: string } | null }): T {
  dbCheck(result.error);
  if (result.data === null) throw new AppError('Aplica la migración SOC 041 y vuelve a intentarlo.', 503);
  return result.data;
}
export const threatShieldStore: ThreatShieldStore = {
  async claimAuth(ip) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new AppError('El control SOC no está configurado.', 503);
    const hash = createHmac('sha256', key).update('soc:auth:' + ip).digest('hex');
    return requireData(await guardianAdminClient().rpc('claim_gatekeeper_attempt', { p_key_hash: hash }).abortSignal(AbortSignal.timeout(3000)));
  },
  async snapshot() {
    if (!isConfigured()) return { level: 5, updatedAt: new Date(0).toISOString(), updatedBy: null, reason: 'Desarrollo sin Supabase', registrationsOpen: true, gatekeeperEnabled: false, quarantinedIps: [] };
    return threatSnapshot(requireData(await guardianAdminClient().rpc('guardian_soc_snapshot', {}).abortSignal(AbortSignal.timeout(3000))));
  },
  async fail(ip, reason) {
    const raw = object(requireData(await guardianAdminClient().rpc('guardian_soc_fail', { p_ip: ip, p_reason: reason }).abortSignal(AbortSignal.timeout(3000))));
    if (typeof raw.quarantined !== 'boolean' || typeof raw.recentCount !== 'number' || !Number.isInteger(raw.recentCount) || raw.recentCount < 1 || (raw.expiresAt !== null && (typeof raw.expiresAt !== 'number' || !Number.isFinite(raw.expiresAt)))) throw new AppError('Respuesta de cuarentena no válida.', 503);
    return { quarantined: raw.quarantined, recentCount: raw.recentCount, expiresAt: raw.expiresAt as number | null };
  },
  async quarantine(ip, action, reason, actor) {
    requireData(await guardianAdminClient().rpc('guardian_soc_quarantine', { p_ip: ip, p_action: action, p_reason: reason, p_actor: actor }).abortSignal(AbortSignal.timeout(3000)));
  },
  async defcon(level, actor, reason) {
    requireData(await guardianAdminClient().rpc('guardian_soc_defcon', { p_level: level, p_actor: actor, p_reason: reason }).abortSignal(AbortSignal.timeout(3000)));
  },
  async telemetry() {
    const raw = object(requireData(await guardianAdminClient().rpc('guardian_soc_telemetry', {}).abortSignal(AbortSignal.timeout(3000))));
    const snapshot = threatSnapshot(raw);
    const events = (Array.isArray(raw.recentThreats) ? raw.recentThreats : []).slice(0,20).map((entry): ThreatSecurityEvent => {
      const row = object(entry), metadata = object(row.metadata);
      const severity = metadata.severity === 'critical' || metadata.severity === 'high' || metadata.severity === 'medium' ? metadata.severity : 'low';
      return { id: String(row.id), event: String(row.event), severity, ip: typeof metadata.ip === 'string' ? metadata.ip : '', actor_id: typeof metadata.actor_id === 'string' ? metadata.actor_id : null, metadata, created_at: String(row.created_at) };
    });
    if (typeof raw.attacksBlockedToday !== 'number' || !Number.isSafeInteger(raw.attacksBlockedToday) || raw.attacksBlockedToday < 0) throw new AppError('Contador SOC no válido.', 503);
    return { snapshot, events, attacksBlockedToday: raw.attacksBlockedToday };
  },
};
