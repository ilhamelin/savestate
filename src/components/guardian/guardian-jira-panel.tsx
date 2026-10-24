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
      className="guardian-cloud-card guardian-jira-panel"
      aria-label="Jira y tickets de soporte"
    >
      <div className="guardian-cloud-header">
        <div className="guardian-cloud-title-group">
          <span className="provider-badge">🎫 JIRA SERVICEDESK</span>
          <span className="provider-sub">Soporte e incidentes técnicos</span>
        </div>
        <div
          className={`status-pill ${
            dashboard?.connection === 'online' ? 'status-ready' : 'status-neutral'
          }`}
        >
          <span
            className={`pulse-dot ${
              dashboard?.connection === 'online' ? 'dot-green' : 'dot-amber'
            }`}
          ></span>
          <span>{dashboard?.connection === 'online' ? 'ONLINE' : 'STANDBY'}</span>
        </div>
      </div>

      <div className="cloud-btn-grid mb-2">
        <a
          className="btn-cloud-primary"
          href={config.instanceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          🚀 Jira Cloud ({config.projectKey}) ↗
        </a>
        <a
          className="btn-cloud-secondary"
          href={config.portalUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          🌐 Portal de Soporte ↗
        </a>
      </div>

      {dashboard && !dashboard.authenticated && (
        <p className="notice mb-2">
          Configura JIRA_PORTAL_TOKEN en el servidor para sincronizar. Los reportes permanecen
          guardados.
        </p>
      )}

      <div className="guardian-section-title-bar">
        <h2 className="text-xs font-bold text-slate-200 tracking-wider uppercase">
          Tickets de SaveState ({dashboard?.tickets.length ?? 0})
        </h2>
        <button
          type="button"
          className="btn-cloud-pr"
          disabled={Boolean(busy) || !dashboard}
          onClick={() => void action('retry')}
        >
          {busy === 'retry' ? 'Revisando…' : '↻ Conciliar cola'}
        </button>
      </div>

      <ul className="guardian-jira-list">
        {dashboard?.tickets.map((ticket) => (
          <li key={ticket.id} className="guardian-jira-item">
            <div className="flex items-center justify-between gap-2 mb-1">
              <strong className="text-xs text-slate-100 font-semibold truncate flex-1">
                {ticket.input.title}
              </strong>
              <span
                className={`guardian-jira-tag ${
                  ticket.status === 'synced_jira'
                    ? 'is-synced'
                    : ticket.status === 'needs_review' || ticket.status === 'sending'
                      ? 'is-review'
                      : 'is-pending'
                }`}
              >
                {ticket.status === 'synced_jira'
                  ? '✓ Jira'
                  : ticket.status === 'needs_review' || ticket.status === 'sending'
                    ? '⚠ Por conciliar'
                    : ticket.status === 'stored_local'
                      ? 'Local · Pendiente'
                      : 'En cola'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
              <span>
                {new Date(ticket.created_at).toLocaleDateString('es-CL')} · {ticket.input.type}
              </span>
              {ticket.jira_issue_key ? (
                <a
                  className="cloud-detail-link text-cyan-400 hover:underline"
                  href={config.instanceUrl + '/browse/' + ticket.jira_issue_key}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {ticket.jira_issue_key} ↗
                </a>
              ) : (
                <span className="font-mono text-slate-500">LOCAL-{ticket.id.slice(0, 8)}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {dashboard?.tickets.length === 0 && (
        <p className="cloud-details-box text-center text-xs text-slate-400">
          Aún no hay reportes recibidos en la cola.
        </p>
      )}

      <div className="guardian-section-title-bar mt-3">
        <h2 className="text-xs font-bold text-slate-200 tracking-wider uppercase">
          Telemetría · incidentes
        </h2>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">
        Buffer distribuido de errores serverless sin datos personales.
      </p>

      <ul className="guardian-jira-list">
        {events.map((event) => (
          <li key={event.id} className="guardian-jira-item">
            <div className="flex items-start justify-between gap-2">
              <strong className="text-xs text-rose-300 font-medium break-all flex-1">
                {event.message}
              </strong>
              <button
                type="button"
                className="btn-cloud-pr"
                disabled={Boolean(busy) || event.escalatedToJira}
                onClick={() => void action('escalate', event.id)}
              >
                {busy === event.id
                  ? 'Escalando…'
                  : event.escalatedToJira
                    ? '✓ En Jira'
                    : '⚡ Escalar'}
              </button>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              {event.pathname} · {new Date(event.timestamp).toLocaleTimeString('es-CL')}
            </div>
            {event.stack && (
              <details className="mt-1 text-[10px]">
                <summary className="text-slate-400 cursor-pointer hover:text-cyan-300">
                  Ver traza de error
                </summary>
                <pre className="mt-1 p-2 bg-black/60 rounded text-slate-300 text-[10px] overflow-x-auto font-mono">
                  {event.stack}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ul>
      {!events.length && (
        <p className="cloud-details-box text-center text-xs text-slate-400">
          Sin incidentes registrados en el buffer.
        </p>
      )}

      {notice && (
        <p className="notice mt-3" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
