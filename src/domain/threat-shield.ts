import { object, text, ValidationError } from './validation.ts';
export const DEFCON_LEVELS = [5, 4, 3, 2, 1] as const;
export type DefconLevel = (typeof DEFCON_LEVELS)[number];
export const DEFCON_LABELS: Record<DefconLevel, { label: string; color: string; desc: string }> = {
  5: { label: 'DEFCON 5 · NORMAL', color: '#10b981', desc: 'Operación estándar.' },
  4: { label: 'DEFCON 4 · ELEVATED', color: '#f59e0b', desc: 'Autenticación limitada: 5 fallos por minuto.' },
  3: { label: 'DEFCON 3 · SUBSTANTIAL', color: '#f97316', desc: 'Registros congelados; mutaciones solo con cuenta verificada.' },
  2: { label: 'DEFCON 2 · CRITICAL', color: '#ef4444', desc: 'Solo lectura; nuevas subidas de Bóveda desactivadas.' },
  1: { label: 'DEFCON 1 · LOCKDOWN', color: '#881337', desc: 'Acceso exclusivo al operador autenticado con TOTP reciente.' },
};
export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';
export interface ThreatSecurityEvent { id: string; event: string; severity: ThreatSeverity; ip: string; actor_id?: string | null; metadata: Record<string, unknown>; created_at: string; }
export interface QuarantinedIpEntry { ip: string; reason: string; attempts: number; quarantinedAt: number; expiresAt: number; }
export interface SocTelemetryReport {
  defconLevel: DefconLevel;
  defconMetadata: { updatedAt: string; updatedBy: string; reason: string };
  quarantinedCount: number; quarantinedIps: QuarantinedIpEntry[];
  attacksBlockedToday: number; recentThreats: ThreatSecurityEvent[]; generatedAt: string;
  registrationsOpen: boolean; decisionLatencyMs: number | null;
  cacheTtlMs: number; counterScope: 'automatic_quarantines_utc';
}
export interface RateLimitConfig { windowMs: number; maxAttempts: number; quarantineMs: number; }
export const DEFAULT_AUTH_RATE_LIMIT: RateLimitConfig = { windowMs: 60_000, maxAttempts: 5, quarantineMs: 15 * 60_000 };
export const SOC_CACHE_TTL_MS = 3000;
export function recordIpAttempt(attempts: number[], nowMs = Date.now(), config: RateLimitConfig = DEFAULT_AUTH_RATE_LIMIT): { quarantined: boolean; recentCount: number } {
  if (!Number.isFinite(nowMs) || nowMs < 0 || !Number.isInteger(config.maxAttempts) || config.maxAttempts < 1 || !Number.isFinite(config.windowMs) || config.windowMs <= 0 || !Number.isFinite(config.quarantineMs) || config.quarantineMs <= 0) throw new RangeError('Configuración de ventana no válida.');
  const recent = attempts.filter((time) => Number.isFinite(time) && time > nowMs - config.windowMs && time <= nowMs);
  return { quarantined: recent.length + 1 >= config.maxAttempts, recentCount: recent.length + 1 };
}
export function defconLevel(value: unknown): DefconLevel {
  if (typeof value !== 'number' || !DEFCON_LEVELS.some((level) => level === value)) throw new ValidationError('Nivel DEFCON no válido.');
  return value as DefconLevel;
}
export function normalizeThreatIp(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 45 || raw !== raw.trim() || /[\s/%?#@\[\]]/.test(raw)) return null;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(raw)) {
    const parts = raw.split('.');
    return parts.every((part) => Number(part) <= 255 && String(Number(part)) === part) ? parts.join('.') : null;
  }
  if (!raw.includes(':')) return null;
  try {
    const ip = new URL('http://[' + raw + ']/').hostname.slice(1, -1).toLowerCase();
    const mapped = ip.match(/^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/);
    if (mapped) { const value = parseInt(mapped[1]!, 16) * 65536 + parseInt(mapped[2]!, 16); return [24,16,8,0].map((shift) => (value >>> shift) & 255).join('.'); }
    return ip;
  } catch { return null; }
}
export function defconInput(raw: unknown) {
  const input = object(raw), level = defconLevel(input.level);
  const reason = text(input.reason, 'Motivo', 240);
  if (reason.length < 5) throw new ValidationError('Describe el motivo con al menos 5 caracteres.');
  if (level <= 3 && input.confirmCritical !== true) throw new ValidationError('Confirma explícitamente el nivel crítico.');
  return { level, reason };
}
export function quarantineInput(raw: unknown) {
  const input = object(raw), ip = normalizeThreatIp(input.ip);
  if (!ip || (input.action !== 'block' && input.action !== 'unblock')) throw new ValidationError('IP o acción no válida.');
  const reason = input.reason === undefined && input.action === 'unblock' ? 'Levantada por el operador desde Guardian SOC' : text(input.reason, 'Motivo', 240);
  if (reason.length < 5) throw new ValidationError('Describe el motivo con al menos 5 caracteres.');
  return { ip, action: input.action as 'block' | 'unblock', reason };
}
export function socRecoveryPath(path: string): boolean {
  return ['/status','/api/system-status','/login','/gatekeeper','/auth/callback','/auth/confirm','/api/auth/password','/api/gatekeeper/verify','/guardian','/guardian/','/guardian-sw.js','/manifest.webmanifest'].includes(path) || path.startsWith('/api/guardian/') || path.startsWith('/guardian/') || path.startsWith('/guardian-assets/') || path.startsWith('/_next/');
}
export function socQuarantineExempt(path: string): boolean {
  return path === '/status' || path === '/api/system-status' || path === '/guardian' || path.startsWith('/guardian/') || path.startsWith('/api/guardian/') || path.startsWith('/_next/') || path.startsWith('/guardian-assets/') || path === '/guardian-sw.js';
}
export function socRestriction(level: DefconLevel, path: string, method: string): 'open' | 'readonly' | 'verified' | 'operator' {
  if (socRecoveryPath(path)) return 'open';
  const mutation = !['GET','HEAD','OPTIONS'].includes(method.toUpperCase()) || path.startsWith('/api/cron/');
  if (level <= 2 && mutation) return 'readonly';
  if (level === 1) return 'operator';
  if (level === 3 && mutation) return 'verified';
  return 'open';
}
export interface ThreatShieldSnapshot {
  level: DefconLevel; updatedAt: string; updatedBy: string | null; reason: string;
  registrationsOpen: boolean; gatekeeperEnabled: boolean; quarantinedIps: QuarantinedIpEntry[];
}
export function threatSnapshot(raw: unknown): ThreatShieldSnapshot {
  const value = object(raw);
  const level = defconLevel(value.level);
  if (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) || typeof value.registrationsOpen !== 'boolean' || typeof value.gatekeeperEnabled !== 'boolean' || !Array.isArray(value.quarantinedIps)) throw new Error('Estado SOC no válido.');
  const quarantinedIps = value.quarantinedIps.map((row) => {
    const item = object(row), ip = normalizeThreatIp(item.ip);
    if (!ip || typeof item.reason !== 'string' || typeof item.attempts !== 'number' || !Number.isInteger(item.attempts) || item.attempts < 0 || typeof item.quarantinedAt !== 'number' || !Number.isFinite(item.quarantinedAt) || typeof item.expiresAt !== 'number' || !Number.isFinite(item.expiresAt)) throw new Error('Cuarentena no válida.');
    return { ip, reason: item.reason.slice(0,240), attempts: item.attempts, quarantinedAt: item.quarantinedAt, expiresAt: item.expiresAt };
  });
  return { level, updatedAt: value.updatedAt, updatedBy: typeof value.updatedBy === 'string' ? value.updatedBy : null, reason: typeof value.reason === 'string' ? value.reason : '', registrationsOpen: value.registrationsOpen, gatekeeperEnabled: value.gatekeeperEnabled, quarantinedIps };
}
