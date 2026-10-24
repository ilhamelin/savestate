import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { jiraConfig } from '@/services/jira-support-service';
import { cachedTwitchAccessToken, twitchAccessToken } from '@/integrations/igdb/server';
import {
  DEPENDENCY_CACHE_TTL_MS,
  DEPENDENCY_SERVICE_IDS,
  computeOverallHealth,
  evaluateHealthStatus,
  type DependencyHealthCheck,
  type DependencyServiceId,
  type SystemHealthReport,
} from '@/domain/dependency-monitor';

interface MonitorOptions {
  fetcher?: typeof fetch;
  now?: () => number;
  monotonic?: () => number;
  env?: () => Record<string, string | undefined>;
  portal?: () => string;
  twitchToken?: () => string | null;
  authorizeTwitch?: (signal: AbortSignal) => Promise<string>;
  timeoutMs?: number;
}
const definitions: Record<
  DependencyServiceId,
  Pick<DependencyHealthCheck, 'name' | 'category' | 'endpointPreview'>
> = {
  supabase: {
    name: 'Supabase',
    category: 'database',
    endpointPreview: 'PostgreSQL · system_switches (HEAD)',
  },
  steam: {
    name: 'Steam Web API',
    category: 'gaming',
    endpointPreview: 'api.steampowered.com · GetServerInfo',
  },
  igdb: {
    name: 'Twitch / IGDB',
    category: 'gaming',
    endpointPreview: 'id.twitch.tv · OAuth validate',
  },
  jira: {
    name: 'Jira · Portal',
    category: 'devops',
    endpointPreview: 'Portal de soporte · HTTPS HEAD',
  },
  discord: {
    name: 'Discord Gateway',
    category: 'infrastructure',
    endpointPreview: 'discord.com · gateway HTTP',
  },
  vercel: {
    name: 'Vercel · Runtime',
    category: 'infrastructure',
    endpointPreview: 'Procesamiento local · sin prueba de CDN',
  },
};
export function createDependencyMonitor(options: MonitorOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const monotonic = options.monotonic ?? (() => performance.now());
  const env = options.env ?? (() => process.env);
  const portal = options.portal ?? (() => jiraConfig().portalUrl);
  const twitchToken = options.twitchToken ?? cachedTwitchAccessToken;
  const authorizeTwitch = options.authorizeTwitch ?? twitchAccessToken;
  let cached: { report: SystemHealthReport; expiresAt: number } | null = null;
  let pending: Promise<SystemHealthReport> | null = null;
  let configuration = '';
  async function probe(
    id: DependencyServiceId,
    config: Record<string, string | undefined>,
    token: string | null,
  ): Promise<DependencyHealthCheck> {
    const start = monotonic();
    const budget = options.timeoutMs ?? (id === 'steam' || id === 'igdb' ? 3500 : 3000);
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(budget)]);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let maintenance = false;
    let message = 'Endpoint HTTP disponible; no comprueba todas las funciones del proveedor.';
    const http = async (url: string, init?: RequestInit) => {
      const response = await fetcher(url, {
        ...init,
        cache: 'no-store',
        redirect: 'manual',
        signal,
      });
      await response.body?.cancel();
      // A portal redirect is reachability evidence, not authentication evidence.
      if (!response.ok && !(id === 'jira' && response.status >= 300 && response.status < 400))
        throw new Error('HTTP failure');
    };
    try {
      await Promise.race([
        (async () => {
          switch (id) {
            case 'supabase':
              if (!config.NEXT_PUBLIC_SUPABASE_URL || !config.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
                maintenance = true;
                message = 'Base de datos sin configurar; no se ha medido disponibilidad.';
                break;
              }
              {
                const client = createClient(
                  config.NEXT_PUBLIC_SUPABASE_URL,
                  config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                  {
                    auth: { persistSession: false, autoRefreshToken: false },
                    global: {
                      fetch: (input, init) =>
                        fetcher(input, { ...init, cache: 'no-store', redirect: 'error' }),
                    },
                  },
                );
                const result = await client
                  .from('system_switches')
                  .select('key', { count: 'exact', head: true })
                  .abortSignal(signal);
                if (result.error) throw new Error('Database unavailable');
                message =
                  'Consulta de cabecera PostgreSQL correcta; no comprueba sesiones ni escrituras.';
              }
              break;
            case 'steam':
              await http('https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/');
              break;
            case 'discord':
              await http('https://discord.com/api/v10/gateway');
              message =
                'Gateway HTTP disponible; no comprueba permisos del bot ni entrega de mensajes.';
              break;
            case 'jira':
              await http(portal(), { method: 'HEAD' });
              message = 'Portal accesible; no comprueba autenticación ni creación de tickets.';
              break;
            case 'igdb':
              if (!config.TWITCH_CLIENT_ID || !config.TWITCH_CLIENT_SECRET) {
                maintenance = true;
                message = 'Twitch / IGDB sin configurar.';
                break;
              }
              await http('https://id.twitch.tv/oauth2/validate', {
                headers: { Authorization: 'OAuth ' + (token ?? await authorizeTwitch(signal)) },
              });
              message =
                'Token compartido de Twitch válido; no comprueba consultas del catálogo IGDB.';
              break;
            case 'vercel':
              await Promise.resolve();
              message = 'Runtime respondiendo. No mide la red Edge, CDN ni otras regiones.';
          }
        })(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new Error('Probe deadline'));
          }, budget);
        }),
      ]);
      return {
        id,
        ...definitions[id],
        status: maintenance
          ? 'maintenance'
          : evaluateHealthStatus(monotonic() - start, false, false),
        latencyMs: maintenance ? 0 : Math.max(0, Math.round(monotonic() - start)),
        lastCheckedAt: new Date(now()).toISOString(),
        message,
      };
    } catch {
      return {
        id,
        ...definitions[id],
        status: 'down',
        latencyMs:
          controller.signal.aborted || signal.aborted
            ? budget
            : Math.max(0, Math.round(monotonic() - start)),
        lastCheckedAt: new Date(now()).toISOString(),
        message:
          controller.signal.aborted || signal.aborted
            ? 'Tiempo de espera agotado. Se reintentará en la próxima lectura.'
            : 'La sonda no pudo confirmar el servicio. No implica una caída global del proveedor.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
  return async function getReport(forceRefresh = false): Promise<SystemHealthReport> {
    const config = { ...env() };
    const token = twitchToken();
    // Private fingerprint stays in memory; never serialized into reports or diagnostics.
    const signature = JSON.stringify([
      config.NEXT_PUBLIC_SUPABASE_URL,
      config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      config.TWITCH_CLIENT_ID,
      config.TWITCH_CLIENT_SECRET,
      config.JIRA_PORTAL_URL,
    ]);
    if (signature !== configuration) {
      cached = null;
      pending = null;
      configuration = signature;
    }
    if (!forceRefresh && cached && cached.expiresAt > now()) return structuredClone(cached.report);
    if (!pending) {
      const request = (async () => {
        const settled = await Promise.allSettled(
          DEPENDENCY_SERVICE_IDS.map((id) => probe(id, config, token)),
        );
        const services: DependencyHealthCheck[] = settled.map((item, index) =>
          item.status === 'fulfilled'
            ? item.value
            : {
                id: DEPENDENCY_SERVICE_IDS[index]!,
                ...definitions[DEPENDENCY_SERVICE_IDS[index]!],
                status: 'down',
                latencyMs: 0,
                lastCheckedAt: new Date(now()).toISOString(),
                message: 'Sonda no disponible.',
              },
        );
        const measured = services.filter((service) => service.status !== 'maintenance');
        const report: SystemHealthReport = {
          overall: computeOverallHealth(services),
          services,
          averageLatencyMs: measured.length
            ? Math.round(measured.reduce((sum, item) => sum + item.latencyMs, 0) / measured.length)
            : 0,
          operationalCount: services.filter((item) => item.status === 'operational').length,
          degradedCount: services.filter((item) => item.status === 'degraded').length,
          outageCount: services.filter((item) => item.status === 'down').length,
          generatedAt: new Date(now()).toISOString(),
        };
        if (configuration === signature)
          cached = { report, expiresAt: now() + DEPENDENCY_CACHE_TTL_MS };
        return report;
      })();
      pending = request;
      const clear = () => {
        if (pending === request) pending = null;
      };
      void request.then(clear, clear);
    }
    return structuredClone(await pending);
  };
}
export const getSystemHealthReport = createDependencyMonitor();
