export const DEPENDENCY_SERVICE_IDS = ['supabase', 'steam', 'igdb', 'jira', 'discord', 'vercel'] as const;
export type DependencyServiceId = (typeof DEPENDENCY_SERVICE_IDS)[number];
export type DependencyHealthStatus = 'operational' | 'degraded' | 'down' | 'maintenance';
export interface DependencyHealthCheck {
  id: DependencyServiceId;
  name: string;
  category: 'database' | 'gaming' | 'devops' | 'infrastructure';
  status: DependencyHealthStatus;
  latencyMs: number;
  lastCheckedAt: string;
  message: string;
  endpointPreview: string;
}
export interface SystemHealthReport {
  overall: DependencyHealthStatus;
  services: DependencyHealthCheck[];
  averageLatencyMs: number;
  operationalCount: number;
  degradedCount: number;
  outageCount: number;
  generatedAt: string;
}
export interface DependencyThresholds {
  degradedLatencyMs: number;
  downLatencyMs: number;
}
export const DEPENDENCY_CACHE_TTL_MS = 30_000;
export const DEPENDENCY_STATUS_LABELS: Record<DependencyHealthStatus, string> = {
  operational: 'Operativo',
  degraded: 'Degradado',
  down: 'Sin respuesta',
  maintenance: 'Sin comprobar',
};
export function evaluateHealthStatus(
  latencyMs: number,
  isError: boolean,
  isTimeout: boolean,
  thresholds: DependencyThresholds = { degradedLatencyMs: 1000, downLatencyMs: 3500 },
): DependencyHealthStatus {
  if (isError || isTimeout || !Number.isFinite(latencyMs) || latencyMs < 0) return 'down';
  return latencyMs >= thresholds.degradedLatencyMs ? 'degraded' : 'operational';
}
export function computeOverallHealth(services: DependencyHealthCheck[]): DependencyHealthStatus {
  const database = services.find((service) => service.id === 'supabase');
  if (database?.status === 'down') return 'down';
  if (database?.status === 'maintenance' || services.length === 0) return 'maintenance';
  return services.some((service) => service.status !== 'operational') ? 'degraded' : 'operational';
}
export function dependencyIncident(report: SystemHealthReport | null, service?: DependencyServiceId) {
  return report?.services.find((item) => (!service || item.id === service) && item.status !== 'operational') ?? null;
}
/** Only explicit provider failures are eligible; generic browser errors remain actionable. */
export function knownDependencyFailure(message: string, report: SystemHealthReport): DependencyServiceId | null {
  const providers: [DependencyServiceId, RegExp][] = [
    ['steam', /\b(?:steam|steampowered)\b/i], ['igdb', /\b(?:igdb|twitch)\b/i],
    ['discord', /\bdiscord\b/i], ['jira', /\b(?:jira|portal de soporte)\b/i],
  ];
  if (!/timeout|timed out|unavailable|no disponible|502|503|504|ECONNRESET/i.test(message)) return null;
  return providers.find(([id, pattern]) => pattern.test(message) && report.services.some((item) => item.id === id && item.status === 'down'))?.[0] ?? null;
}
