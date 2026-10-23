'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_JIRA_CONFIG,
  type SupportDashboard,
  type TelemetryErrorEvent,
} from '@/domain/support-ticket';
export function GuardianJiraPanel() {
  const [dashboard, setDashboard] = useState<SupportDashboard | null>(null);
  const [events, setEvents] = useState<TelemetryErrorEvent[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const [tickets, errors] = await Promise.all([
        fetch('/api/support/tickets', { cache: 'no-store', signal }),
        fetch('/api/telemetry/errors', { cache: 'no-store', signal }),
      ]);
      if (!tickets.ok || !errors.ok) {
        const failed = !tickets.ok ? tickets : errors;
        const errJson = (await failed.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          errJson?.error || `Error ${failed.status}: No se pudo cargar Jira. Comprueba la sesión.`,
        );
      }
      const [nextDashboard, nextEvents] = await Promise.all([tickets.json(), errors.json()]);
      if (!signal.aborted) {
        setDashboard(nextDashboard);
        setEvents(nextEvents.events);
        setNotice('');
      }
    } catch (error) {
      if (!signal.aborted) setNotice(error instanceof Error ? error.message : 'Sin conexión.');
    }
  }, []);
  useEffect(() => {
    let active: AbortController | null = null;
    const refresh = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      active?.abort();
      active = new AbortController();
      void load(active.signal);
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      clearInterval(timer);
      active?.abort();
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [load]);
  const config = dashboard?.config ?? DEFAULT_JIRA_CONFIG;
  async function action(kind: 'retry' | 'escalate', id?: string) {
    if (busy) return;
    setBusy(id ?? kind);
    setNotice('');
    try {
      const response = await fetch('/api/telemetry/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: kind, id }),
        signal: AbortSignal.timeout(35000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'No se pudo completar la operación.');
      setNotice(
        result.data ? result.data.ticketId + ' · ' + result.data.message : 'Cola revisada.',
      );
      await load(AbortSignal.timeout(10000));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Sin conexión.');
    } finally {
      setBusy(null);
    }
  }
  return (
    <section
      className="guardian-operator-panel guardian-jira-panel"
      aria-label="Jira y tickets de soporte"
    >
      <p className="eyebrow">OPERATOR // SUPPORT CONTROL</p>
      <div className="guardian-jira-links">
        <a className="button" href={config.instanceUrl} target="_blank" rel="noopener noreferrer">
          🚀 Abrir Jira Cloud ({config.projectKey}) ↗
        </a>
        <a
          className="button outline"
          href={config.portalUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          🌐 Portal de Solicitudes ↗
        </a>
      </div>
      <p role="status">
        {dashboard?.connection === 'online' ? '● ONLINE' : '○ STANDBY'} · API del Portal
      </p>
      {dashboard && !dashboard.authenticated && (
        <p className="notice">
          Configura JIRA_PORTAL_TOKEN en el servidor para sincronizar. Los reportes permanecen
          guardados.
        </p>
      )}
      <h2>Tickets de SaveState</h2>
      <button
        type="button"
        className="button outline small"
        disabled={Boolean(busy) || !dashboard}
        onClick={() => void action('retry')}
      >
        {busy === 'retry' ? 'Revisando…' : '↻ Reintentar / conciliar cola'}
      </button>
      <ul className="guardian-jira-list">
        {dashboard?.tickets.map((ticket) => (
          <li key={ticket.id}>
            <strong>{ticket.input.title}</strong>
            <span className="tag">
              {ticket.status === 'synced_jira'
                ? '✓ Jira'
                : ticket.status === 'needs_review' || ticket.status === 'sending'
                  ? '⚠ Recepción por conciliar'
                  : ticket.status === 'stored_local'
                    ? 'Portal · Jira pendiente'
                    : 'En cola'}
            </span>
            <small>
              {new Date(ticket.created_at).toLocaleString('es-CL')} · {ticket.input.type}
            </small>
            {ticket.jira_issue_key ? (
              <a
                href={config.instanceUrl + '/browse/' + ticket.jira_issue_key}
                target="_blank"
                rel="noopener noreferrer"
              >
                {ticket.jira_issue_key} ↗
              </a>
            ) : (
              <small>LOCAL-{ticket.id}</small>
            )}
          </li>
        ))}
      </ul>
      {dashboard?.tickets.length === 0 && <p className="muted">Aún no hay reportes recibidos.</p>}
      <h2>Telemetría · últimos 50 incidentes</h2>
      <p className="muted">
        Buffer compartido entre funciones serverless. Sin cookies, parámetros de URL ni
        identificadores de sesión. Los reportes de visitantes pueden requerir revisión.
      </p>
      <ul className="guardian-jira-list">
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.message}</strong>
            <small>
              {event.pathname} · {new Date(event.timestamp).toLocaleString('es-CL')}
            </small>
            {event.stack && (
              <details>
                <summary>Ver stack</summary>
                <pre>{event.stack}</pre>
              </details>
            )}
            <button
              type="button"
              className="button outline small"
              disabled={Boolean(busy) || event.escalatedToJira}
              onClick={() => void action('escalate', event.id)}
            >
              {busy === event.id
                ? 'Escalando…'
                : event.escalatedToJira
                  ? '✓ Reporte registrado'
                  : '⚡ Escalar a Jira'}
            </button>
          </li>
        ))}
      </ul>
      {!events.length && <p className="muted">Sin incidentes en el buffer.</p>}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
