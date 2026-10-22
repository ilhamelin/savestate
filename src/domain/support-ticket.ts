import { object, text, ValidationError } from './validation.ts';

export type SupportTicketType = 'bug' | 'game_suggestion' | 'feature_request';
export type SupportTicketPriority = 'baja' | 'media' | 'alta' | 'urgente';
export interface SupportTicketInput {
  type: SupportTicketType;
  title: string;
  description: string;
  contactEmail?: string | null;
  username?: string | null;
  pageUrl: string;
  systemContext?: { userAgent: string; screenResolution?: string; theme?: string };
}
export interface SupportTicketCreated {
  ticketId: string;
  status: 'synced_jira' | 'queued' | 'stored_local';
  createdAt: string;
  jiraUrl?: string;
  message: string;
}
export interface TelemetryErrorEvent {
  id: string;
  message: string;
  stack?: string;
  pathname: string;
  timestamp: string;
  userId?: string | null;
  userAgent: string;
  escalatedToJira: boolean;
  jiraIssueKey?: string | null;
}
export interface JiraLinkConfig {
  instanceUrl: string;
  portalUrl: string;
  apiUrl: string;
  projectKey: string;
}
export const DEFAULT_JIRA_CONFIG: JiraLinkConfig = {
  instanceUrl: 'https://portal-solicitudes-dev.atlassian.net',
  portalUrl: 'https://portal-solicitudes-jira.vercel.app',
  apiUrl: 'https://jira-portal-solicitudes.onrender.com/api/v1',
  projectKey: 'SOL',
};
export const SUPPORT_CATEGORIES = [
  ['bug', '🐛 Bug / Error'],
  ['game_suggestion', '🎮 Sugerir juego'],
  ['feature_request', '⚡ Feature'],
] as const;
export const SUPPORT_TIMEOUT_MS = 8000;
export const TELEMETRY_LIMIT = 50;
export interface SupportTicketRow {
  id: string;
  input: SupportTicketInput;
  status: 'queued' | 'sending' | 'synced_jira' | 'stored_local' | 'needs_review';
  created_at: string;
  updated_at: string;
  remote_id: string | null;
  jira_issue_key: string | null;
  telemetry_id: string | null;
  attempts: number;
  locked_until: string | null;
  lease_token: string | null;
  next_attempt_at: string;
}
export interface SupportDashboard {
  config: Pick<JiraLinkConfig, 'instanceUrl' | 'portalUrl' | 'projectKey'>;
  connection: 'online' | 'standby';
  authenticated: boolean;
  tickets: SupportTicketRow[];
}
export function supportPath(value: string): string {
  try {
    const parsed = new URL(value, 'https://savestate.invalid');
    const path = parsed.pathname;
    return path.startsWith('/') && !path.startsWith('//') ? path.slice(0, 300) : '/';
  } catch {
    return '/';
  }
}
export function validateSupportTicket(raw: unknown): SupportTicketInput {
  const data = object(raw);
  if (!SUPPORT_CATEGORIES.some(([type]) => type === data.type))
    throw new ValidationError('Categoría de soporte no válida.');
  const email =
    data.contactEmail == null || data.contactEmail === ''
      ? null
      : text(data.contactEmail, 'Correo', 254);
  if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))
    throw new ValidationError('Correo de contacto no válido.');
  const context = data.systemContext === undefined ? null : object(data.systemContext);
  return {
    type: data.type as SupportTicketType,
    title: text(data.title, 'Título', 200, 5),
    description: text(data.description, 'Detalle', 8000, 10),
    contactEmail: email,
    username: data.username == null ? null : text(data.username, 'Usuario', 30, 0),
    pageUrl: supportPath(text(data.pageUrl, 'Página', 2000)),
    ...(context
      ? {
          systemContext: {
            userAgent: text(context.userAgent, 'Navegador', 300, 0),
            ...(context.screenResolution === undefined
              ? {}
              : {
                  screenResolution: text(context.screenResolution, 'Pantalla', 30, 0),
                }),
            ...(context.theme === undefined ? {} : { theme: text(context.theme, 'Tema', 30, 0) }),
          },
        }
      : {}),
  };
}
export function redactTelemetry(value: string): string {
  return value
    .replace(/https?:\/\/[^\s)<>]+/gi, (url) => supportPath(url))
    .replace(/(\/[^\s<>?]*)\?[^\s)<>]+/g, '$1')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(
      /\b(password|token|secret|authorization|cookie|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[redacted]',
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]');
}
export function validateTelemetry(raw: unknown, now = Date.now()): TelemetryErrorEvent {
  const data = object(raw);
  return {
    id: crypto.randomUUID(),
    message: redactTelemetry(text(data.message, 'Error', 1000)).slice(0, 500),
    ...(data.stack === undefined
      ? {}
      : { stack: redactTelemetry(text(data.stack, 'Stack', 3000, 0)).slice(0, 1500) }),
    pathname: supportPath(text(data.pathname, 'Ruta', 2000)),
    timestamp: new Date(now).toISOString(),
    userId: null,
    userAgent: redactTelemetry(text(data.userAgent ?? '', 'Navegador', 300, 0)),
    escalatedToJira: false,
    jiraIssueKey: null,
  };
}
export class TelemetryRingBuffer {
  private events: TelemetryErrorEvent[] = [];
  add(event: TelemetryErrorEvent): TelemetryErrorEvent {
    const existing = this.events.find(
      (item) =>
        item.message === event.message &&
        item.pathname === event.pathname &&
        item.stack === event.stack &&
        Date.parse(event.timestamp) - Date.parse(item.timestamp) < 300000,
    );
    if (existing) return { ...existing };
    this.events = [...this.events, { ...event }].slice(-TELEMETRY_LIMIT);
    return { ...event };
  }
  list(): TelemetryErrorEvent[] {
    return this.events.toReversed().map((item) => ({ ...item }));
  }
}
