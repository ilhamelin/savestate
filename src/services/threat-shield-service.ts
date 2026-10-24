import 'server-only';
import { AppError } from '@/lib/http';
import {
  normalizeThreatIp,
  recordIpAttempt,
  defconLevel,
  SOC_CACHE_TTL_MS,
  DEFAULT_AUTH_RATE_LIMIT,
  type DefconLevel,
  type QuarantinedIpEntry,
  type SocTelemetryReport,
  type ThreatShieldSnapshot,
} from '@/domain/threat-shield';
import { threatShieldStore, type ThreatShieldStore } from '@/services/threat-shield-store';
import { clearSystemSwitchCache } from '@/services/system-state';
import { configuredGateSecret } from '@/services/gatekeeper';

export function trustedThreatIp(request: Request): string | null {
  // Never accept client-supplied x-forwarded-for or an IP from a request body.
  return process.env.VERCEL === '1' || process.env.VERCEL === 'true'
    ? normalizeThreatIp(request.headers.get('x-vercel-forwarded-for'))
    : null;
}
export function createThreatShield({
  store,
  now = Date.now,
  clock = () => performance.now(),
  ensureGateReady = () => {
    configuredGateSecret();
  },
  invalidateSwitches = clearSystemSwitchCache,
}: {
  store: ThreatShieldStore;
  now?: () => number;
  clock?: () => number;
  ensureGateReady?: () => void;
  invalidateSwitches?: () => void;
}) {
  const ipAttemptsMap = new Map<string, number[]>();
  const quarantinedIpsMap = new Map<string, QuarantinedIpEntry>();
  let cached: { snapshot: ThreatShieldSnapshot; until: number } | null = null;
  let pending: Promise<ThreatShieldSnapshot> | null = null;
  let generation = 0;
  let decisionLatencyMs: number | null = null;
  function invalidate() {
    generation++;
    cached = null;
    pending = null;
  }
  function prune() {
    const instant = now();
    for (const [ip, times] of ipAttemptsMap) {
      const current = times.filter((time) => time > instant - DEFAULT_AUTH_RATE_LIMIT.windowMs);
      if (!current.length) ipAttemptsMap.delete(ip);
      else ipAttemptsMap.set(ip, current);
    }
    for (const [ip, entry] of quarantinedIpsMap)
      if (entry.expiresAt <= instant) quarantinedIpsMap.delete(ip);
  }
  function accept(snapshot: ThreatShieldSnapshot) {
    if (snapshot.quarantinedIps.length > 10000)
      throw new AppError('SOC excedió la capacidad de caché; revisa la cuarentena.', 503);
    quarantinedIpsMap.clear();
    for (const entry of snapshot.quarantinedIps)
      if (entry.expiresAt > now()) quarantinedIpsMap.set(entry.ip, structuredClone(entry));
    prune();
    cached = { snapshot: structuredClone(snapshot), until: now() + SOC_CACHE_TTL_MS };
  }
  async function sync(force = false): Promise<ThreatShieldSnapshot> {
    if (!force && cached && cached.until > now()) return structuredClone(cached.snapshot);
    if (!pending) {
      const version = generation;
      const request = store.snapshot().then((snapshot) => {
        if (version === generation) accept(snapshot);
        return structuredClone(snapshot);
      });
      pending = request;
      const clear = () => {
        if (pending === request) pending = null;
      };
      void request.then(clear, clear);
    }
    return structuredClone(await pending);
  }
  function isIpBlocked(raw: string): boolean {
    const started = clock();
    const ip = normalizeThreatIp(raw);
    const entry = ip ? quarantinedIpsMap.get(ip) : undefined;
    const blocked = Boolean(entry && entry.expiresAt > now());
    if (entry && !blocked) quarantinedIpsMap.delete(entry.ip);
    decisionLatencyMs = Math.max(0, clock() - started);
    return blocked;
  }
  async function registerFailedAuthAttempt(raw: string, reason: string) {
    const ip = normalizeThreatIp(raw);
    if (!ip) throw new AppError('No se pudo identificar el origen de autenticación.', 503);
    if (isIpBlocked(ip))
      return { quarantined: true, recentCount: quarantinedIpsMap.get(ip)!.attempts };
    prune();
    if (ipAttemptsMap.size >= 5000 && !ipAttemptsMap.has(ip))
      ipAttemptsMap.delete(ipAttemptsMap.keys().next().value!);
    const history = ipAttemptsMap.get(ip) ?? [];
    const local = recordIpAttempt(history, now());
    ipAttemptsMap.set(ip, [...history, now()].slice(-5));
    if (local.quarantined)
      quarantinedIpsMap.set(ip, {
        ip,
        reason: reason.slice(0, 240),
        attempts: local.recentCount,
        quarantinedAt: now(),
        expiresAt: now() + DEFAULT_AUTH_RATE_LIMIT.quarantineMs,
      });
    // Atomic backend counter is authoritative across instances. A failed write is never reported as an audited success.
    const result = await store.fail(ip, reason.slice(0, 240));
    invalidate();
    if (result.quarantined)
      quarantinedIpsMap.set(ip, {
        ip,
        reason: reason.slice(0, 240),
        attempts: result.recentCount,
        quarantinedAt: now(),
        expiresAt: result.expiresAt ?? now() + DEFAULT_AUTH_RATE_LIMIT.quarantineMs,
      });
    return result;
  }
  async function claimAuthSlot(level: DefconLevel, ip: string | null) {
    if (level <= 4 && ip && !(await store.claimAuth(ip)))
      throw new AppError('Límite de autenticación: espera un minuto.', 429);
  }
  async function setDefconLevel(raw: DefconLevel, actor: string, reason: string) {
    const level = defconLevel(raw);
    if (reason.trim().length < 5 || reason.length > 240)
      throw new AppError('Motivo no válido.', 400);
    if (level === 1) ensureGateReady();
    await store.defcon(level, actor, reason.trim());
    invalidate();
    invalidateSwitches();
  }
  async function changeQuarantine(
    ip: string,
    action: 'block' | 'unblock',
    reason: string,
    actor: string,
  ) {
    const normalized = normalizeThreatIp(ip);
    if (!normalized) throw new AppError('IP no válida.', 400);
    await store.quarantine(normalized, action, reason, actor);
    invalidate();
    if (action === 'unblock') {
      quarantinedIpsMap.delete(normalized);
      ipAttemptsMap.delete(normalized);
    } else
      quarantinedIpsMap.set(normalized, {
        ip: normalized,
        reason,
        attempts: 0,
        quarantinedAt: now(),
        expiresAt: now() + DEFAULT_AUTH_RATE_LIMIT.quarantineMs,
      });
  }
  async function getSocTelemetryReport(): Promise<SocTelemetryReport> {
    const { snapshot, events, attacksBlockedToday } = await store.telemetry();
    accept(snapshot);
    return {
      defconLevel: snapshot.level,
      defconMetadata: {
        updatedAt: snapshot.updatedAt,
        updatedBy: snapshot.updatedBy ?? 'Sistema',
        reason: snapshot.reason,
      },
      quarantinedCount: snapshot.quarantinedIps.filter((entry) => entry.expiresAt > now()).length,
      quarantinedIps: structuredClone(
        snapshot.quarantinedIps.filter((entry) => entry.expiresAt > now()),
      ),
      attacksBlockedToday,
      recentThreats: structuredClone(events),
      generatedAt: new Date(now()).toISOString(),
      registrationsOpen: snapshot.registrationsOpen,
      decisionLatencyMs,
      cacheTtlMs: SOC_CACHE_TTL_MS,
      counterScope: 'automatic_quarantines_utc',
    };
  }
  return {
    sync,
    isIpBlocked,
    registerFailedAuthAttempt,
    setDefconLevel,
    changeQuarantine,
    getSocTelemetryReport,
    claimAuthSlot,
  };
}
const shield = createThreatShield({ store: threatShieldStore });
export const refreshThreatShieldSnapshot = shield.sync;
export const isIpBlocked = shield.isIpBlocked;
export const registerFailedAuthAttempt = shield.registerFailedAuthAttempt;
export const setDefconLevel = shield.setDefconLevel;
export const changeQuarantine = shield.changeQuarantine;
export const getSocTelemetryReport = shield.getSocTelemetryReport;
export const claimSocAuthSlot = shield.claimAuthSlot;
export function threatQuarantineResponse(ip: string | null): Response | null {
  if (!ip || !isIpBlocked(ip)) return null;
  return Response.json(
    {
      error: 'Origen temporalmente en cuarentena. Reintenta en 15 minutos o contacta al operador.',
    },
    {
      status: 429,
      headers: {
        'Cache-Control': 'private, no-store',
        'Retry-After': '900',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
