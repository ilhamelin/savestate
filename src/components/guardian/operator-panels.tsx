'use client';
import { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import type { guardianTelemetry } from '@/services/guardian-suite';
import { useOnlineUsers } from '@/lib/presence';
import type { SystemSwitches } from '@/domain/guardian-suite';
async function request(path: string, input?: unknown) {
  const response = await fetch(
    `/api/guardian/${path}`,
    input === undefined
      ? { cache: 'no-store' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'No se pudo completar la operación.');
  return result;
}
export function GuardianAlertPanel() {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'info' | 'warning' | 'event'>('info');
  const [discord, setDiscord] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  useEffect(() => {
    let mounted = true;
    request('broadcast')
      .then((result) => {
        if (mounted) setActive(result.broadcast?.message ?? null);
      })
      .catch(() => {
        if (mounted) setNotice('No se pudo cargar el anuncio actual.');
      });
    return () => {
      mounted = false;
    };
  }, []);
  async function publish(enabled: boolean) {
    setBusy(true);
    setNotice('');
    try {
      const result = await request('broadcast', {
        message,
        category,
        active: enabled,
        notifyDiscord: discord,
      });
      setActive(enabled ? message : null);
      setNotice(
        result.data.discord === 'failed'
          ? 'Alerta publicada en la web. Discord falló; consulta la bitácora.'
          : enabled
            ? `Alerta publicada${result.data.discord === 'sent' ? ' en la web y Discord' : ''}.`
            : 'Alerta desactivada en la web. El mensaje ya enviado a Discord se conserva.',
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Error al publicar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="guardian-operator-panel">
      <h2>🚨 Transmisión global</h2>
      <p className="notice">{active ? `Activa: ${active}` : 'No hay alertas activas.'}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void publish(true);
        }}
      >
        <label>
          Mensaje
          <textarea
            required
            maxLength={240}
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        <small>{message.length}/240</small>
        <label>
          Categoría
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as typeof category)}
          >
            <option value="info">Información · Cian</option>
            <option value="warning">Advertencia · Ámbar</option>
            <option value="event">Evento · Púrpura</option>
          </select>
        </label>
        <label className="guardian-check">
          <input
            type="checkbox"
            checked={discord}
            onChange={(event) => setDiscord(event.target.checked)}
          />
          Enviar también a #anuncios-savestate
        </label>
        <button type="submit" className="button" disabled={busy || !message.trim()}>
          {busy ? 'Procesando…' : '🚨 Lanzar alerta'}
        </button>
        <button
          type="button"
          className="button outline"
          disabled={busy || !active}
          onClick={() => void publish(false)}
        >
          Apagar alerta web
        </button>
      </form>
      <p role="status">{notice}</p>
    </section>
  );
}
export function GuardianSwitchPanel() {
  const [switches, setSwitches] = useState<SystemSwitches | null>(null);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [arm, setArm] = useState(false);
  useEffect(() => {
    let mounted = true;
    request('switches')
      .then((result) => {
        if (mounted) setSwitches(result);
      })
      .catch((error) => {
        if (mounted) setNotice(error.message);
      });
    return () => {
      mounted = false;
    };
  }, []);
  async function update(key: keyof SystemSwitches, value: boolean | string) {
    setBusy(true);
    setNotice('');
    try {
      await request('switches', { key, value });
      setSwitches((current) => (current ? { ...current, [key]: value } : current));
      setArm(false);
      setNotice(
        'Interruptor actualizado. Propagación máxima: 10 segundos; el tema se actualizará en las páginas abiertas.',
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo actualizar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="guardian-operator-panel">
      <h2>🎛️ Interruptores maestros</h2>
      {switches ? (
        <>
          <button
            type="button"
            className="guardian-switch"
            role="switch"
            aria-checked={switches.gatekeeper_enabled}
            disabled={busy}
            onClick={() =>
              switches.gatekeeper_enabled ? void update('gatekeeper_enabled', false) : setArm(true)
            }
          >
            🛡️ Web Gatekeeper{' '}
            <strong>{switches.gatekeeper_enabled ? 'ACTIVO' : 'DESACTIVADO'}</strong>
          </button>
          {arm && (
            <div className="notice">
              <p>
                El bloqueo exigirá el código del teléfono a los visitantes. Comprueba que puedes
                generarlo antes de activarlo.
              </p>
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => void update('gatekeeper_enabled', true)}
              >
                Confirmar activación del bloqueo
              </button>
              <button className="button outline" type="button" onClick={() => setArm(false)}>
                Cancelar
              </button>
            </div>
          )}
          <button
            type="button"
            className="guardian-switch"
            role="switch"
            aria-checked={switches.registrations_open}
            disabled={busy}
            onClick={() => void update('registrations_open', !switches.registrations_open)}
          >
            📝 Registro de nuevos usuarios{' '}
            <strong>{switches.registrations_open ? 'ABIERTOS' : 'CERRADOS'}</strong>
          </button>
          <button
            type="button"
            className="guardian-switch"
            role="switch"
            aria-checked={switches.double_xp}
            disabled={busy}
            onClick={() => void update('double_xp', !switches.double_xp)}
          >
            ⚡ Evento Doble XP (Multiplicador x2){' '}
            <strong>{switches.double_xp ? 'ACTIVO (x2 XP)' : 'NORMAL (x1)'}</strong>
          </button>
          <button
            type="button"
            className="guardian-switch"
            role="switch"
            aria-checked={switches.seasonal_theme === 'halloween'}
            disabled={busy}
            onClick={() =>
              void update(
                'seasonal_theme',
                switches.seasonal_theme === 'halloween' ? 'classic' : 'halloween',
              )
            }
          >
            🎃 Tema estacional{' '}
            <strong>{switches.seasonal_theme === 'halloween' ? 'HALLOWEEN' : 'CLÁSICO'}</strong>
          </button>
        </>
      ) : (
        <p>Cargando interruptores…</p>
      )}
      <p role="status">{notice}</p>
    </section>
  );
}
type Telemetry = Awaited<ReturnType<typeof guardianTelemetry>>;
const metric = (value: number | null, suffix = '') =>
  value === null ? 'Sin datos' : `${value}${suffix}`;
interface Audit {
  id: string;
  event: string;
  key_hash: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}
export function GuardianHudPanel({ adminId }: { adminId: string }) {
  const online = useOnlineUsers(adminId);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [logs, setLogs] = useState<Audit[]>([]);
  const [attempts, setAttempts] = useState<
    { key_hash: string; attempts: number; window_start: string }[]
  >([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true,
      running = false;
    async function refresh() {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        const [data, security] = await Promise.all([
          request('telemetry'),
          request('security-logs'),
        ]);
        if (mounted) {
          setTelemetry(data);
          setLogs(security.logs);
          setAttempts(security.attempts);
          setError('');
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'No se pudo actualizar el HUD.');
      } finally {
        running = false;
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return (
    <section className="guardian-operator-panel">
      <h2>📊 Telemetría del nodo</h2>
      {error && <p role="alert">{error} Las últimas métricas pueden estar desactualizadas.</p>}
      {telemetry ? (
        <>
          <article className="guardian-hardware-card" aria-label="Hardware de Supabase">
            <header className="guardian-hw-header">
              <span className="guardian-hw-icon" aria-hidden="true">
                <Database size={22} />
              </span>
              <div className="guardian-hw-titles">
                <h3>Primary Database</h3>
                <small>
                  {[telemetry.database.region, telemetry.database.host]
                    .filter(Boolean)
                    .join(' · ') || 'Supabase · PostgreSQL'}
                </small>
              </div>
            </header>
            <div className="guardian-hw-metrics">
              <span>
                CPU <strong>{metric(telemetry.database.cpuPercent, '%')}</strong>
              </span>
              <span>
                Disk <strong>{metric(telemetry.database.diskPercent, '%')}</strong>
              </span>
              <span>
                RAM <strong>{metric(telemetry.database.ramPercent, '%')}</strong>
              </span>
              <span>
                <strong>
                  {metric(telemetry.database.connections.active)} /{' '}
                  {metric(telemetry.database.connections.max)}
                </strong>{' '}
                conns
              </span>
            </div>
            <p className="guardian-hw-footer">
              Consulta SQL {telemetry.database.latencyMs} ms · Buffer cache{' '}
              {metric(telemetry.database.cacheHitRatio, '%')}
              <br />
              Base de datos{' '}
              {metric(
                telemetry.database.diskSizeBytes === null
                  ? null
                  : Math.round(telemetry.database.diskSizeBytes / 1048576),
                ' MB',
              )}{' '}
              · Disco /data{' '}
              {metric(
                telemetry.database.diskUsedBytes === null
                  ? null
                  : Math.round(telemetry.database.diskUsedBytes / 1048576),
                ' MB',
              )}{' '}
              /{' '}
              {metric(
                telemetry.database.diskTotalBytes === null
                  ? null
                  : Math.round(telemetry.database.diskTotalBytes / 1048576),
                ' MB',
              )}
              <br />
              {telemetry.database.measuredAt
                ? `Hardware: ${new Date(telemetry.database.measuredAt).toLocaleTimeString('es-CL')} · caché 60 s`
                : 'Hardware no disponible; se mantienen las métricas SQL.'}
              {telemetry.database.cpuPercent === null &&
                ' CPU requiere dos muestras del mismo proceso.'}
            </p>
          </article>
          <article className="guardian-hardware-card vercel" aria-label="Hardware de Vercel">
            <header className="guardian-hw-header">
              <span className="guardian-hw-icon vercel" aria-hidden="true">
                ▲
              </span>
              <div className="guardian-hw-titles">
                <h3>Vercel Serverless Network</h3>
                <small>
                  {telemetry.vercel.regionLabel.flag} {telemetry.vercel.regionLabel.label}
                </small>
              </div>
            </header>
            <div className="guardian-hw-metrics">
              <span>
                CPU <strong>{telemetry.vercel.computeMs} ms</strong>
              </span>
              <span>
                RAM{' '}
                <strong>
                  {telemetry.vercel.memory.rssMB} MB ({metric(telemetry.vercel.memory.percent, '%')}
                  )
                </strong>
              </span>
              <span>
                <strong>
                  {telemetry.vercel.env.toUpperCase()} ·{' '}
                  {telemetry.vercel.commit ? `#${telemetry.vercel.commit}` : 'SHA no disponible'}
                </strong>
              </span>
              <span>
                <strong>{telemetry.vercel.warm ? 'Warm' : 'Primera medición'}</strong>
              </span>
            </div>
            <p className="guardian-hw-footer">
              Solicitud {telemetry.vercel.elapsedMs} ms · Heap {telemetry.vercel.memory.heapUsedMB}{' '}
              MB · Límite {metric(telemetry.vercel.memory.limitMB, ' MB')}
              <br />
              Proceso activo {telemetry.vercel.uptimeSec} s · Medición de esta instancia; no
              representa toda la red.
            </p>
          </article>
          <div className="guardian-hud-grid">
            <article>
              <small>R2 · archivos registrados</small>
              <strong>{(telemetry.storage.bytes / 1048576).toFixed(2)} MB</strong>
            </article>
            <article>
              <small>Jugadores registrados</small>
              <strong>{telemetry.users.total}</strong>
            </article>
            <article>
              <small>En línea · Realtime Presence</small>
              <strong>{online.size}</strong>
            </article>
            <article>
              <small>Actividad de biblioteca · 15 min</small>
              <strong>{telemetry.users.recent}</strong>
            </article>
            <article>
              <small>Discord · API del bot</small>
              <strong>
                {telemetry.discord.available
                  ? 'DISPONIBLE'
                  : telemetry.discord.configured
                    ? 'SIN RESPUESTA'
                    : 'SIN CONFIGURAR'}
              </strong>
            </article>
          </div>
          <p className="muted">
            Medido: {new Date(telemetry.measuredAt).toLocaleTimeString('es-CL')}. Los MB
            corresponden a la suma registrada de la bóveda; no incluyen objetos huérfanos.
          </p>
        </>
      ) : (
        <p>Cargando salud del sistema…</p>
      )}
      <h3>🛡️ Bitácora de seguridad</h3>
      <ul className="guardian-audit-list">
        {logs.map((log) => (
          <li key={log.id}>
            <strong>{log.event}</strong>
            <time>{new Date(log.created_at).toLocaleString('es-CL')}</time>
            {log.key_hash && <code>Huella: {log.key_hash.slice(0, 12)}…</code>}
            <small>{JSON.stringify(log.metadata)}</small>
          </li>
        ))}
      </ul>
      {!logs.length && <p className="muted">Sin eventos registrados.</p>}
      <details>
        <summary>Ventanas recientes del limitador ({attempts.length})</summary>
        {attempts.map((attempt) => (
          <p key={attempt.key_hash}>
            <code>{attempt.key_hash.slice(0, 12)}…</code> · {attempt.attempts} intentos ·{' '}
            {new Date(attempt.window_start).toLocaleTimeString('es-CL')}
          </p>
        ))}
      </details>
    </section>
  );
}
