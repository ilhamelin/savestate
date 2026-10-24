'use client';
import '@/styles/guardian-soc.css';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  DEFCON_LEVELS,
  DEFCON_LABELS,
  type DefconLevel,
  type SocTelemetryReport,
} from '@/domain/threat-shield';
import { startSystemStatusPolling } from '@/lib/system-status-polling';
const severityLabels = { low: 'INFO', medium: 'WARNING', high: 'HIGH', critical: 'CRITICAL' };
export function GuardianSocPanel() {
  const [report, setReport] = useState<SocTelemetryReport | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<DefconLevel | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [activity, setActivity] = useState('Esperando conexión');
  const dialog = useRef<HTMLDialogElement>(null);
  const wake = useRef<(() => void) | null>(null);
  const action = useRef<AbortController | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element || level === null) return;
    element.showModal();
    return () => {
      if (element.open) element.close();
    };
  }, [level]);
  useEffect(() => {
    let active = true;
    const polling = startSystemStatusPolling({
      isActive: () => navigator.onLine && document.visibilityState !== 'hidden',
      schedule(callback, delay) {
        const timer = window.setTimeout(callback, delay);
        return () => clearTimeout(timer);
      },
      async refresh(signal) {
        const timeout = AbortSignal.any([signal, AbortSignal.timeout(7000)]);
        const response = await fetch('/api/guardian/soc/telemetry', {
          cache: 'no-store',
          signal: timeout,
        });
        if (!response.ok) {
          if (active && !timeout.aborted) {
            if (response.status === 401 || response.status === 403) setReport(null);
            setNotice(
              response.status === 403
                ? 'Vuelve a iniciar sesión como operador.'
                : 'No se pudo leer el SOC; se conserva la última lectura.',
            );
          }
          throw new Error('SOC unavailable');
        }
        const next: SocTelemetryReport = await response.json();
        if (active && !timeout.aborted) setReport(next);
      },
    });
    wake.current = polling.wake;
    const update = () => {
      setActivity(
        !navigator.onLine
          ? 'Sin conexión · controles en pausa'
          : document.visibilityState === 'hidden'
            ? 'Sondeo en pausa'
            : 'Actualización cada 30 s',
      );
      polling.wake();
    };
    const timer = window.setTimeout(update, 0);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      active = false;
      polling.stop();
      wake.current = null;
      action.current?.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  async function mutate(path: 'defcon' | 'quarantine', input: Record<string, unknown>) {
    if (action.current) return false;
    const controller = new AbortController();
    action.current = controller;
    setBusy(true);
    setNotice('Enviando orden al SOC…');
    try {
      const response = await fetch('/api/guardian/soc/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'La orden no se pudo aplicar.');
      if (!controller.signal.aborted) {
        setNotice(
          'Orden registrada. Propagación a otras instancias: hasta 3 s más el tiempo de lectura.',
        );
        wake.current?.();
      }
      return true;
    } catch (error) {
      if (!controller.signal.aborted)
        setNotice(error instanceof Error ? error.message : 'No se pudo completar la orden.');
      return false;
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      action.current = null;
    }
  }
  return (
    <section
      className="guardian-cloud-panel guardian-soc-panel"
      aria-label="Guardian SOC Threat Shield"
      aria-busy={busy}
    >
      <header className="guardian-cloud-card">
        <p className="eyebrow">SECURITY OPERATIONS // THREAT SHIELD</p>
        <h2>
          {report ? DEFCON_LABELS[report.defconLevel].label : 'Esperando postura de seguridad'}
        </h2>
        <p className="muted" role="status">
          {activity}
        </p>
        <div className="soc-defcon-levels" aria-label="Seleccionar nivel DEFCON">
          {DEFCON_LEVELS.map((item) => (
            <button
              key={item}
              type="button"
              className="button outline small"
              style={{ '--soc-color': DEFCON_LABELS[item].color } as CSSProperties}
              aria-pressed={report?.defconLevel === item}
              disabled={busy || !report}
              onClick={() => {
                setConfirmed(false);
                setLevel(item);
              }}
            >
              DEFCON {item}
            </button>
          ))}
        </div>
        {report && (
          <p className="muted">
            {DEFCON_LABELS[report.defconLevel].desc}
            <br />
            Último cambio: {report.defconMetadata.updatedAt} · {report.defconMetadata.updatedBy}
            <br />
            {report.defconMetadata.reason}
          </p>
        )}
      </header>
      <div className="soc-metrics">
        <article className="guardian-cloud-card">
          <span>🛡️ Bloqueos automáticos hoy</span>
          <strong>{report?.attacksBlockedToday ?? '—'}</strong>
          <small>Cuarentenas registradas · día UTC</small>
        </article>
        <article className="guardian-cloud-card">
          <span>🚫 IPs en cuarentena</span>
          <strong>{report?.quarantinedCount ?? '—'}</strong>
          <small>Estado compartido en Supabase</small>
        </article>
        <article className="guardian-cloud-card">
          <span>⚡ Decisión local en caché</span>
          <strong>
            {report?.decisionLatencyMs == null
              ? 'Sin muestras'
              : report.decisionLatencyMs.toFixed(3) + ' ms'}
          </strong>
          <small>Esta instancia; excluye red y lectura inicial</small>
        </article>
        <article className="guardian-cloud-card">
          <span>🔐 Nuevos registros</span>
          <strong>{report ? (report.registrationsOpen ? 'Abiertos' : 'Congelados') : '—'}</strong>
          <small>Protegidos también en Supabase Auth</small>
        </article>
      </div>
      <section className="guardian-cloud-card" aria-label="Gestor de cuarentena">
        <h2>Cuarentena perimetral de aplicación</h2>
        <p className="muted">
          5 fallos en 60 s · aislamiento de 15 minutos. El WAF nativo de Vercel conserva sus propias
          políticas. Una caché fría requiere consultar el estado compartido.
        </p>
        <form
          className="soc-quarantine-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            if (
              await mutate('quarantine', {
                action: 'block',
                ip: data.get('ip'),
                reason: data.get('reason'),
              })
            )
              form.reset();
          }}
        >
          <label>
            IP (IPv4 o IPv6)
            <input
              name="ip"
              required
              maxLength={45}
              autoComplete="off"
              placeholder="192.0.2.1"
              disabled={busy}
            />
          </label>
          <label>
            Motivo
            <input name="reason" required minLength={5} maxLength={240} disabled={busy} />
          </label>
          <button type="submit" className="button outline small" disabled={busy || !report}>
            Aislar IP
          </button>
        </form>
        <ul className="guardian-cloud-list">
          {report?.quarantinedIps.map((entry) => (
            <li key={entry.ip} className="guardian-cloud-entry">
              <div className="guardian-cloud-row">
                <strong>{entry.ip}</strong>
                <span title={new Date(entry.expiresAt).toISOString()}>
                  Restan{' '}
                  {Math.max(
                    0,
                    Math.ceil((entry.expiresAt - Date.parse(report.generatedAt)) / 60000),
                  )}{' '}
                  min · última lectura
                </span>
              </div>
              <p>
                {entry.reason} · {entry.attempts} fallos
              </p>
              <button
                type="button"
                className="button outline small"
                disabled={busy}
                onClick={() => void mutate('quarantine', { action: 'unblock', ip: entry.ip })}
              >
                Levantar Cuarentena
              </button>
            </li>
          ))}
        </ul>
        {report?.quarantinedCount === 0 && (
          <p className="muted">Sin IPs aisladas en la última lectura.</p>
        )}
      </section>
      <section className="guardian-cloud-card" aria-label="Radar de amenazas">
        <h2>Threat Feed · últimos 20 eventos</h2>
        <ul className="guardian-cloud-list">
          {report?.recentThreats.map((entry) => (
            <li className="guardian-cloud-entry" key={entry.id}>
              <div className="guardian-cloud-row">
                <span className={'soc-severity severity-' + entry.severity}>
                  {severityLabels[entry.severity]}
                </span>
                <time dateTime={entry.created_at}>{entry.created_at}</time>
              </div>
              <strong>{entry.event}</strong>
              <span>
                {entry.ip || 'Evento de postura'}
                {entry.actor_id ? ' · Operador: ' + entry.actor_id : ''}
              </span>
              <p>{typeof entry.metadata.reason === 'string' ? entry.metadata.reason : ''}</p>
            </li>
          ))}
        </ul>
        {report?.recentThreats.length === 0 && <p className="muted">Sin amenazas registradas.</p>}
        {report && <p className="muted">Lectura: {report.generatedAt}</p>}
      </section>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <dialog
        className="guardian-management-dialog"
        ref={dialog}
        aria-labelledby="soc-confirm-title"
        onClose={() => setLevel(null)}
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (level === null) return;
            const data = new FormData(event.currentTarget);
            if (
              await mutate('defcon', {
                level,
                reason: data.get('reason'),
                confirmCritical: confirmed,
              })
            ) {
              dialog.current?.close();
              setLevel(null);
            }
          }}
        >
          <h2 id="soc-confirm-title">
            {level === null ? 'Cambiar postura' : DEFCON_LABELS[level].label}
          </h2>
          <p>{level === null ? '' : DEFCON_LABELS[level].desc}</p>
          {level !== null && level <= 3 && (
            <p className="notice">
              Este nivel restringe el servicio para la comunidad. DEFCON 1 exige sesión del operador
              y una clave TOTP emitida después de activar el bloqueo.
            </p>
          )}
          <label>
            Motivo obligatorio
            <input name="reason" minLength={5} maxLength={240} required disabled={busy} />
          </label>
          {level !== null && level <= 3 && (
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                required
                onChange={(event) => setConfirmed(event.target.checked)}
              />{' '}
              Confirmo el impacto y, para DEFCON 1, dispongo del dispositivo TOTP activado.
            </label>
          )}
          <div className="guardian-cloud-row">
            <button
              type="button"
              className="button outline small"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="button"
              disabled={busy || (level !== null && level <= 3 && !confirmed)}
            >
              {busy ? 'Aplicando…' : 'Confirmar postura'}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
