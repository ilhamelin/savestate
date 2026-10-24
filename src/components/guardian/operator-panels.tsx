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
    <section className="guardian-cloud-card" aria-label="Transmisión global">
      <div className="guardian-cloud-header">
        <div className="guardian-cloud-title-group">
          <span className="provider-badge">🚨 BROADCAST</span>
          <span className="provider-sub">Transmisión global en vivo</span>
        </div>
        <div className={`status-pill ${active ? 'status-ready' : 'status-neutral'}`}>
          <span className={`pulse-dot ${active ? 'dot-amber' : ''}`}></span>
          <span>{active ? 'ALERTA ACTIVA' : 'EN ESPERA'}</span>
        </div>
      </div>

      {active ? (
        <div className="guardian-active-alert-box">
          <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">
            <span>🔴 En el encabezado web</span>
            <span>Activo</span>
          </div>
          <p className="guardian-active-alert-text">“{active}”</p>
        </div>
      ) : (
        <div className="cloud-details-box text-xs">
          <span className="text-slate-400">Sin transmisiones activas en el banner superior.</span>
        </div>
      )}

      <form
        className="guardian-broadcast-form mt-2"
        onSubmit={(event) => {
          event.preventDefault();
          void publish(true);
        }}
      >
        <div className="guardian-form-group">
          <div className="guardian-field-label">
            <label htmlFor="guardian-broadcast-message">Mensaje del anuncio</label>
            <span className="text-[10px] text-slate-400 font-mono">{message.length}/240</span>
          </div>
          <textarea
            id="guardian-broadcast-message"
            required
            maxLength={240}
            rows={3}
            className="guardian-cyber-textarea"
            placeholder="Mensaje global para todos los jugadores conectados..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>

        <div className="guardian-form-group">
          <label className="guardian-field-label" htmlFor="guardian-broadcast-category">
            Categoría y estilo visual
          </label>
          <select
            id="guardian-broadcast-category"
            className="guardian-cyber-select"
            value={category}
            onChange={(event) => setCategory(event.target.value as typeof category)}
          >
            <option value="info">Información · Cian (#00f0ff)</option>
            <option value="warning">Advertencia · Ámbar (#f59e0b)</option>
            <option value="event">Evento Especial · Púrpura (#c084fc)</option>
          </select>
        </div>

        <div className="guardian-cyber-check">
          <input
            id="guardian-broadcast-discord"
            type="checkbox"
            checked={discord}
            onChange={(event) => setDiscord(event.target.checked)}
          />
          <label htmlFor="guardian-broadcast-discord" className="text-xs text-slate-300">
            Enviar también a{' '}
            <strong className="text-cyan-400 font-mono">#anuncios-savestate</strong>
          </label>
        </div>

        <div className="cloud-btn-grid mt-2">
          <button type="submit" className="btn-cloud-primary" disabled={busy || !message.trim()}>
            {busy ? 'Transmitiendo…' : '🚨 Lanzar alerta'}
          </button>
          <button
            type="button"
            className="btn-cloud-danger"
            disabled={busy || !active}
            onClick={() => void publish(false)}
          >
            ✕ Apagar alerta
          </button>
        </div>
      </form>

      {notice && (
        <p className="notice mt-2" role="status">
          {notice}
        </p>
      )}
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
    <section className="guardian-cloud-card" aria-label="Interruptores maestros">
      <div className="guardian-cloud-header">
        <div className="guardian-cloud-title-group">
          <span className="provider-badge">🎛️ MASTER CONTROLS</span>
          <span className="provider-sub">Interruptores de sistema en tiempo real</span>
        </div>
        <div className="status-pill status-ready">
          <span className="pulse-dot dot-green"></span>
          <span>SINCRONIZADO</span>
        </div>
      </div>

      {switches ? (
        <div className="guardian-switches-list">
          {/* 1. Gatekeeper switch */}
          <div className="guardian-switch-wrapper">
            <button
              type="button"
              className={`guardian-switch-btn ${switches.gatekeeper_enabled ? 'is-on' : 'is-off'}`}
              role="switch"
              aria-checked={switches.gatekeeper_enabled}
              disabled={busy}
              onClick={() =>
                switches.gatekeeper_enabled
                  ? void update('gatekeeper_enabled', false)
                  : setArm(true)
              }
            >
              <div className="guardian-switch-info">
                <div className="guardian-switch-title">
                  <span className="switch-icon">🛡️</span>
                  <span>Web Gatekeeper Lock</span>
                </div>
                <small className="guardian-switch-desc">
                  Bloqueo 2FA de acceso total a visitantes no autenticados
                </small>
              </div>
              <div className="guardian-toggle-track">
                <span className="toggle-thumb" />
                <span className="toggle-label">
                  {switches.gatekeeper_enabled ? 'ACTIVO' : 'OFF'}
                </span>
              </div>
            </button>

            {arm && (
              <div className="guardian-arm-box">
                <p className="text-xs text-amber-200 mb-2 font-medium">
                  ⚠️ Advertencia: El bloqueo exigirá el código de seguridad móvil a todos los
                  visitantes. Verifica que tengas tu TOTP activo antes de confirmar.
                </p>
                <div className="cloud-btn-grid">
                  <button
                    className="btn-cloud-primary"
                    type="button"
                    disabled={busy}
                    onClick={() => void update('gatekeeper_enabled', true)}
                  >
                    Confirmar bloqueo
                  </button>
                  <button
                    className="btn-cloud-secondary"
                    type="button"
                    onClick={() => setArm(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Registrations */}
          <div className="guardian-switch-wrapper">
            <button
              type="button"
              className={`guardian-switch-btn ${switches.registrations_open ? 'is-on' : 'is-off'}`}
              role="switch"
              aria-checked={switches.registrations_open}
              disabled={busy}
              onClick={() => void update('registrations_open', !switches.registrations_open)}
            >
              <div className="guardian-switch-info">
                <div className="guardian-switch-title">
                  <span className="switch-icon">📝</span>
                  <span>Registro de Nuevos Usuarios</span>
                </div>
                <small className="guardian-switch-desc">
                  Permite o cierra la creación de nuevas cuentas
                </small>
              </div>
              <div className="guardian-toggle-track">
                <span className="toggle-thumb" />
                <span className="toggle-label">
                  {switches.registrations_open ? 'ABIERTOS' : 'CERRADOS'}
                </span>
              </div>
            </button>
          </div>

          {/* 3. Double XP */}
          <div className="guardian-switch-wrapper">
            <button
              type="button"
              className={`guardian-switch-btn ${switches.double_xp ? 'is-on' : 'is-off'}`}
              role="switch"
              aria-checked={switches.double_xp}
              disabled={busy}
              onClick={() => void update('double_xp', !switches.double_xp)}
            >
              <div className="guardian-switch-info">
                <div className="guardian-switch-title">
                  <span className="switch-icon">⚡</span>
                  <span>Evento Doble XP (Multiplicador x2)</span>
                </div>
                <small className="guardian-switch-desc">
                  Duplica la ganancia de experiencia en misiones y logros
                </small>
              </div>
              <div className="guardian-toggle-track">
                <span className="toggle-thumb" />
                <span className="toggle-label">
                  {switches.double_xp ? 'ACTIVO (x2)' : 'NORMAL'}
                </span>
              </div>
            </button>
          </div>

          {/* 4. Seasonal Theme */}
          <div className="guardian-switch-wrapper">
            <button
              type="button"
              className={`guardian-switch-btn ${switches.seasonal_theme === 'halloween' ? 'is-on theme-halloween' : 'is-off'}`}
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
              <div className="guardian-switch-info">
                <div className="guardian-switch-title">
                  <span className="switch-icon">🎃</span>
                  <span>Atmósfera Estacional Halloween</span>
                </div>
                <small className="guardian-switch-desc">
                  Efectos de murciélagos, partículas y paleta de noche de brujas
                </small>
              </div>
              <div className="guardian-toggle-track">
                <span className="toggle-thumb" />
                <span className="toggle-label">
                  {switches.seasonal_theme === 'halloween' ? 'HALLOWEEN' : 'CLÁSICO'}
                </span>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div className="cloud-details-box text-center py-4 text-xs text-slate-400">
          Cargando interruptores maestros…
        </div>
      )}

      {notice && (
        <p className="notice mt-3" role="status">
          {notice}
        </p>
      )}
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
    <section className="guardian-operator-panel" aria-label="Telemetría del nodo">
      {error && (
        <p className="notice mb-3" role="alert">
          {error} Las últimas métricas pueden estar desactualizadas.
        </p>
      )}
      {telemetry ? (
        <div className="space-y-3">
          {/* Card 1: Primary Database */}
          <div className="guardian-cloud-card" aria-label="Hardware de Supabase">
            <div className="guardian-cloud-header">
              <div className="guardian-cloud-title-group">
                <span className="provider-badge inline-flex items-center gap-1.5">
                  <Database size={13} className="text-emerald-400" /> SUPABASE POSTGRESQL
                </span>
                <span className="provider-sub">
                  {[telemetry.database.region, telemetry.database.host]
                    .filter(Boolean)
                    .join(' · ') || 'Primary Database'}
                </span>
              </div>
              <div className="status-pill status-ready">
                <span className="pulse-dot dot-green"></span>
                <span>ONLINE</span>
              </div>
            </div>

            <div className="hud-metric-chips-grid">
              <div className="hud-chip">
                <span className="hud-chip-label">CPU</span>
                <strong className="hud-chip-val">
                  {metric(telemetry.database.cpuPercent, '%')}
                </strong>
              </div>
              <div className="hud-chip">
                <span className="hud-chip-label">DISK</span>
                <strong className="hud-chip-val">
                  {metric(telemetry.database.diskPercent, '%')}
                </strong>
              </div>
              <div className="hud-chip">
                <span className="hud-chip-label">RAM</span>
                <strong className="hud-chip-val">
                  {metric(telemetry.database.ramPercent, '%')}
                </strong>
              </div>
              <div className="hud-chip">
                <span className="hud-chip-label">CONNS</span>
                <strong className="hud-chip-val text-emerald-400">
                  {metric(telemetry.database.connections.active)} /{' '}
                  {metric(telemetry.database.connections.max)}
                </strong>
              </div>
            </div>

            <div className="cloud-details-box text-xs">
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Latencia SQL:</span>
                <span className="cloud-detail-value text-emerald-400">
                  {telemetry.database.latencyMs} ms
                </span>
              </div>
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Buffer Cache:</span>
                <span className="cloud-detail-value">
                  {metric(telemetry.database.cacheHitRatio, '%')}
                </span>
              </div>
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Base de datos /data:</span>
                <span className="cloud-detail-value">
                  {metric(
                    telemetry.database.diskSizeBytes === null
                      ? null
                      : Math.round(telemetry.database.diskSizeBytes / 1048576),
                    ' MB',
                  )}
                  {' · '}
                  {metric(
                    telemetry.database.diskUsedBytes === null
                      ? null
                      : Math.round(telemetry.database.diskUsedBytes / 1048576),
                    ' MB',
                  )}
                  {' / '}
                  {metric(
                    telemetry.database.diskTotalBytes === null
                      ? null
                      : Math.round(telemetry.database.diskTotalBytes / 1048576),
                    ' MB',
                  )}
                </span>
              </div>
              {telemetry.database.measuredAt && (
                <div className="cloud-detail-row">
                  <span className="cloud-detail-label">Muestreo:</span>
                  <span className="cloud-detail-value text-slate-400">
                    {new Date(telemetry.database.measuredAt).toLocaleTimeString('es-CL')} (caché
                    60s)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Vercel Serverless Network */}
          <div className="guardian-cloud-card" aria-label="Hardware de Vercel">
            <div className="guardian-cloud-header">
              <div className="guardian-cloud-title-group">
                <span className="provider-badge">▲ VERCEL SERVERLESS</span>
                <span className="provider-sub">
                  {telemetry.vercel.regionLabel.flag} {telemetry.vercel.regionLabel.label}
                </span>
              </div>
              <div className="status-pill status-ready">
                <span className="pulse-dot dot-green"></span>
                <span>{telemetry.vercel.warm ? 'WARM' : 'READY'}</span>
              </div>
            </div>

            <div className="hud-metric-chips-grid">
              <div className="hud-chip">
                <span className="hud-chip-label">COMPUTE</span>
                <strong className="hud-chip-val">{telemetry.vercel.computeMs} ms</strong>
              </div>
              <div className="hud-chip">
                <span className="hud-chip-label">RAM RSS</span>
                <strong className="hud-chip-val">{telemetry.vercel.memory.rssMB} MB</strong>
              </div>
              <div className="hud-chip">
                <span className="hud-chip-label">ENTORNO</span>
                <strong className="hud-chip-val text-white">
                  {telemetry.vercel.env.toUpperCase()}
                </strong>
              </div>
              <div className="hud-chip">
                <span className="hud-chip-label">COMMIT</span>
                <strong className="hud-chip-val text-cyan-300">
                  {telemetry.vercel.commit ? `#${telemetry.vercel.commit.slice(0, 7)}` : 'main'}
                </strong>
              </div>
            </div>

            <div className="cloud-details-box text-xs">
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Tiempo solicitud:</span>
                <span className="cloud-detail-value text-emerald-400">
                  {telemetry.vercel.elapsedMs} ms
                </span>
              </div>
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Heap utilizado:</span>
                <span className="cloud-detail-value">
                  {telemetry.vercel.memory.heapUsedMB} MB /{' '}
                  {metric(telemetry.vercel.memory.limitMB, ' MB')}
                </span>
              </div>
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Uptime proceso:</span>
                <span className="cloud-detail-value">{telemetry.vercel.uptimeSec} s</span>
              </div>
            </div>
          </div>

          {/* Card 3: Grid de Telemetría */}
          <div className="guardian-hud-grid">
            <article>
              <small>📦 R2 · Archivos Bóveda</small>
              <strong>{(telemetry.storage.bytes / 1048576).toFixed(2)} MB</strong>
            </article>
            <article>
              <small>👥 Jugadores Registrados</small>
              <strong>{telemetry.users.total}</strong>
            </article>
            <article>
              <small>🟢 Realtime Presence</small>
              <strong className="text-emerald-400">{online.size} en línea</strong>
            </article>
            <article>
              <small>⚡ Biblioteca (15 min)</small>
              <strong>{telemetry.users.recent}</strong>
            </article>
            <article className="col-span-2">
              <small>🤖 Discord · Bot Gateway</small>
              <strong
                className={telemetry.discord.available ? 'text-emerald-400' : 'text-amber-400'}
              >
                {telemetry.discord.available
                  ? '● DISPONIBLE Y CONECTADO'
                  : telemetry.discord.configured
                    ? '○ SIN RESPUESTA'
                    : '○ SIN CONFIGURAR'}
              </strong>
            </article>
          </div>

          <p className="text-[11px] text-slate-500 font-mono">
            Medido: {new Date(telemetry.measuredAt).toLocaleTimeString('es-CL')}. Los MB
            corresponden a la bóveda registrada.
          </p>

          {/* Card 4: Seguridad y Auditoría */}
          <div className="guardian-cloud-card">
            <div className="guardian-cloud-header">
              <div className="guardian-cloud-title-group">
                <span className="provider-badge">🛡️ SECURITY AUDIT</span>
                <span className="provider-sub">Eventos y huellas de acceso</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{logs.length} eventos</span>
            </div>

            <ul className="guardian-audit-list">
              {logs.map((log) => (
                <li key={log.id} className="guardian-audit-item">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs text-cyan-300 font-mono">{log.event}</strong>
                    <time className="text-[10px] text-slate-500 font-mono">
                      {new Date(log.created_at).toLocaleTimeString('es-CL')}
                    </time>
                  </div>
                  {log.key_hash && (
                    <code className="text-[10px] text-slate-400 font-mono">
                      Huella: {log.key_hash.slice(0, 12)}…
                    </code>
                  )}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <small className="text-[10px] text-slate-500 font-mono truncate">
                      {JSON.stringify(log.metadata)}
                    </small>
                  )}
                </li>
              ))}
              {!logs.length && (
                <li className="text-center text-xs text-slate-500 py-3">
                  Sin eventos registrados.
                </li>
              )}
            </ul>

            {attempts.length > 0 && (
              <details className="text-xs text-slate-400 mt-2">
                <summary className="cursor-pointer hover:text-cyan-300 font-medium">
                  Ventanas recientes del limitador ({attempts.length})
                </summary>
                <div className="space-y-1 mt-2 p-2 bg-black/50 rounded-lg">
                  {attempts.map((attempt) => (
                    <div
                      key={attempt.key_hash}
                      className="text-[10px] font-mono flex justify-between"
                    >
                      <code className="text-slate-300">{attempt.key_hash.slice(0, 12)}…</code>
                      <span className="text-amber-400">{attempt.attempts} intentos</span>
                      <span className="text-slate-500">
                        {new Date(attempt.window_start).toLocaleTimeString('es-CL')}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      ) : (
        <div className="cloud-details-box text-center py-6 text-xs text-slate-400">
          Cargando telemetría del nodo…
        </div>
      )}
    </section>
  );
}
