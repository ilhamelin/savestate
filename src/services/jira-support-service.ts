import 'server-only';
import {
  DEFAULT_JIRA_CONFIG,
  SUPPORT_TIMEOUT_MS,
  type JiraLinkConfig,
  type SupportTicketInput,
  type SupportTicketRow,
  type SupportTicketCreated,
} from '@/domain/support-ticket';
import { supportStore, type SupportStore } from '@/services/support-store';
import { AppError } from '@/lib/http';

function configUrl(raw: string | undefined, fallback: string) {
  const url = new URL(raw || fallback);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new AppError('La configuración del Portal debe usar HTTPS.', 503);
  return url.href.replace(/\/$/, '');
}
export function jiraConfig(): JiraLinkConfig {
  return {
    instanceUrl: configUrl(process.env.JIRA_INSTANCE_URL, DEFAULT_JIRA_CONFIG.instanceUrl),
    portalUrl: configUrl(process.env.JIRA_PORTAL_URL, DEFAULT_JIRA_CONFIG.portalUrl),
    apiUrl: configUrl(process.env.JIRA_API_URL, DEFAULT_JIRA_CONFIG.apiUrl),
    projectKey: /^[A-Z][A-Z0-9]{1,15}$/.test(process.env.JIRA_PROJECT_KEY ?? '')
      ? process.env.JIRA_PROJECT_KEY!
      : DEFAULT_JIRA_CONFIG.projectKey,
  };
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function portalTicketResult(
  raw: unknown,
): Pick<SupportTicketRow, 'remote_id' | 'jira_issue_key' | 'status'> | null {
  const data = record(raw);
  const integration = record(data.jira_integracion);
  const key = integration.jira_issue_key ?? data.jira_issue_key;
  const issueKey = typeof key === 'string' && /^[A-Z][A-Z0-9]*-\d+$/.test(key) ? key : null;
  const remoteId =
    typeof data.id === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(data.id)
      ? data.id
      : null;
  if (!remoteId && !issueKey) return null;
  return {
    remote_id: remoteId,
    jira_issue_key: issueKey,
    status: issueKey ? 'synced_jira' : 'stored_local',
  };
}
export function portalTicketPayload(input: SupportTicketInput, id: string) {
  return {
    titulo: input.title.slice(0, 152) + ' [SS-' + id + ']',
    descripcion: [
      input.description,
      'Origen: SaveState · ' + input.pageUrl,
      input.contactEmail ? 'Contacto voluntario: ' + input.contactEmail : '',
      input.username ? 'Jugador: @' + input.username : '',
      input.systemContext ? 'Contexto: ' + JSON.stringify(input.systemContext) : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    tipo: input.type === 'bug' ? 'incidente' : 'mejora',
    area: input.type === 'game_suggestion' ? 'SaveState Catálogo' : 'SaveState Web',
    prioridad_solicitada: input.type === 'bug' ? 'alta' : 'media',
  };
}
function created(row: SupportTicketRow): SupportTicketCreated {
  const config = jiraConfig();
  return {
    ticketId: row.jira_issue_key || 'LOCAL-' + row.id,
    status:
      row.status === 'synced_jira'
        ? 'synced_jira'
        : row.status === 'stored_local'
          ? 'stored_local'
          : 'queued',
    createdAt: row.created_at,
    ...(row.jira_issue_key
      ? { jiraUrl: config.instanceUrl + '/browse/' + row.jira_issue_key }
      : {}),
    message:
      row.status === 'synced_jira'
        ? 'Ticket recibido en Jira.'
        : row.status === 'stored_local'
          ? 'Solicitud recibida en el Portal; vinculación Jira pendiente.'
          : row.status === 'needs_review' || row.status === 'sending'
            ? 'Reporte guardado. Estamos comprobando su recepción para evitar duplicados.'
            : 'Reporte guardado en la bitácora; se reintentará la sincronización con Jira.',
  };
}
export async function dispatchSupportTicket(id: string, store: SupportStore = supportStore) {
  const row = await store.claim(id);
  if (!row) return null;
  const config = jiraConfig();
  const token = process.env.JIRA_PORTAL_TOKEN?.trim();
  if (!token)
    return store.finish(row, {
      status:
        row.status === 'needs_review' ? 'needs_review' : row.remote_id ? 'stored_local' : 'queued',
    });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPPORT_TIMEOUT_MS);
  const options = {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    cache: 'no-store' as const,
    redirect: 'error' as const,
    signal: controller.signal,
  };
  let posted = false;
  try {
    if (row.remote_id) {
      const response = await fetch(config.apiUrl + '/solicitudes/' + row.remote_id, options);
      if (!response.ok) throw new Error('Portal unavailable');
      const result = portalTicketResult(await response.json());
      return store.finish(row, result ?? { status: 'needs_review' });
    }
    if (row.status === 'needs_review') {
      // The Portal does not implement idempotency keys. Reconcile uncertain writes, never repost them.
      const title = portalTicketPayload(row.input, row.id).titulo;
      for (let offset = 0; offset < 1000; offset += 100) {
        const response = await fetch(
          config.apiUrl + '/solicitudes?limit=100&offset=' + offset,
          options,
        );
        if (!response.ok) throw new Error('Portal unavailable');
        const list: unknown = await response.json();
        if (!Array.isArray(list)) throw new Error('Invalid Portal response');
        const match = list.find((item) => record(item).titulo === title);
        if (match)
          return store.finish(row, portalTicketResult(match) ?? { status: 'needs_review' });
        if (list.length < 100) break;
      }
      return store.finish(row, { status: 'needs_review' });
    }
    // Verify authentication/reachability before attempting a write.
    const ready = await fetch(config.apiUrl + '/solicitudes?limit=1', options);
    if (!ready.ok) throw new Error('Portal unavailable');
    Object.assign(row, await store.markSending(row));
    posted = true;
    const response = await fetch(config.apiUrl + '/solicitudes', {
      ...options,
      method: 'POST',
      headers: { ...options.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(portalTicketPayload(row.input, row.id)),
    });
    if (!response.ok) {
      // These statuses unambiguously reject the request; network/5xx failures need reconciliation.
      return store.finish(row, {
        status: [400, 401, 403, 404, 422, 429].includes(response.status)
          ? 'queued'
          : 'needs_review',
      });
    }
    return store.finish(
      row,
      portalTicketResult(await response.json()) ?? { status: 'needs_review' },
    );
  } catch {
    return store.finish(row, {
      status:
        posted || row.status === 'needs_review' || row.status === 'sending'
          ? 'needs_review'
          : row.status === 'stored_local'
            ? 'stored_local'
            : 'queued',
    });
  } finally {
    clearTimeout(timer);
  }
}
export async function createSupportTicket(
  input: SupportTicketInput,
  telemetryId?: string,
  store: SupportStore = supportStore,
) {
  const row = await store.save(input, telemetryId);
  if (row.status === 'synced_jira') return created(row);
  return created((await dispatchSupportTicket(row.id, store)) ?? row);
}
export async function retrySupportQueue() {
  const rows = await supportStore.pending();
  let processed = 0;
  for (const row of rows) {
    await dispatchSupportTicket(row.id);
    processed++;
  }
  return { processed };
}
export async function supportDashboard() {
  const config = jiraConfig();
  const [tickets, connection] = await Promise.all([
    supportStore.list(),
    fetch(new URL('/health', config.apiUrl), {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(4000),
    })
      .then((res) => (res.ok ? ('online' as const) : ('standby' as const)))
      .catch(() => 'standby' as const),
  ]);
  return {
    config: {
      instanceUrl: config.instanceUrl,
      portalUrl: config.portalUrl,
      projectKey: config.projectKey,
    },
    connection,
    authenticated: Boolean(process.env.JIRA_PORTAL_TOKEN?.trim()),
    tickets,
  };
}
