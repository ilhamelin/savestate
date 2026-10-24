'use client';
import { useEffect, useRef, useState } from 'react';
import { DEPENDENCY_STATUS_LABELS, type SystemHealthReport } from '@/domain/dependency-monitor';
import { useDependencyHealth, publishDependencyHealth } from '@/lib/dependency-health-client';
const icons = { supabase: '🗄️', steam: '🎮', igdb: '🕹️', jira: '🎫', discord: '🤖', vercel: '☁️' };
export function DependencyStatusDashboard({ initial = null, manual = false }: { initial?: SystemHealthReport | null; manual?: boolean }) {
  const live = useDependencyHealth(true);
  const health = live ?? initial;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [activity, setActivity] = useState('Comprobando conexión');
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const update = () => setActivity(!navigator.onLine ? 'Sin conexión · última lectura guardada en esta vista' : document.visibilityState === 'hidden' ? 'Sondeo en pausa' : 'Refresco cada 30 s mientras la pestaña esté visible');
    const timer = window.setTimeout(update, 0);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => {
      clearTimeout(timer); request.current?.abort();
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('online', update); window.removeEventListener('offline', update);
    };
  }, []);
  async function probe() {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/guardian/dependencies/probe', {
        method: 'POST', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Se requiere una sesión activa de operador.' : result.error ?? 'No se pudo completar la sonda.');
      if (!controller.signal.aborted) { publishDependencyHealth(result.health); setNotice('Sonda completada.'); }
    } catch (error) {
      if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : 'No se pudo actualizar.');
    } finally { if (!controller.signal.aborted) setBusy(false); request.current = null; }
  }
  return <section className="dependency-dashboard" aria-label="Salud de dependencias" aria-busy={busy}>
    <header className="guardian-cloud-card dependency-summary">
      <p className="eyebrow">DEPENDENCY MONITOR // LECTURA INSTANTÁNEA</p>
      <h2 className={'dependency-state status-' + (health?.overall ?? 'maintenance')}>
        <span className="dependency-pulse" aria-hidden="true">●</span>{' '}
        {!health ? 'Esperando primera lectura' : health.overall === 'operational' ? 'Todos los sistemas comprobados operativos' : health.overall === 'down' ? 'Incidente en la base de datos principal' : health.overall === 'maintenance' ? 'Disponibilidad sin comprobar' : 'Degradación parcial de servicios'}
      </h2>
      <p>{health ? health.operationalCount + ' / 6 operativos · Latencia media: ' + health.averageLatencyMs + ' ms' : 'Consultando sondas…'}</p>
      <p className="muted" role="status">{activity}</p>
      {health && <p className="muted">Última lectura: <time dateTime={health.generatedAt}>{new Date(health.generatedAt).toLocaleString('es-CL', { timeZone: 'UTC' })} UTC</time></p>}
      <p className="muted">Sondas puntuales, con caché de 30 s por instancia. No constituyen un historial de uptime ni certifican todas las funciones de cada proveedor. Disponibilidad histórica: no calculada.</p>
      {manual && <button type="button" className="button outline small" disabled={busy} onClick={() => void probe()}>{busy ? 'Comprobando…' : '⚡ Probar latencia ahora'}</button>}
      {notice && <p className="notice" role="status">{notice}</p>}
    </header>
    <div className="dependency-grid">
      {health?.services.map((service) => <article key={service.id} className="guardian-cloud-card dependency-card">
        <div className="guardian-cloud-row"><h3>{icons[service.id]} {service.name}</h3><span className={'dependency-state status-' + service.status}>{DEPENDENCY_STATUS_LABELS[service.status]}</span></div>
        <small className="muted">{service.category} · {service.endpointPreview}</small>
        <strong>{service.status === 'maintenance' ? '— ms · sin medir' : service.latencyMs + ' ms'}</strong>
        <meter min={0} max={3500} low={300} high={1000} optimum={0} value={Math.min(3500, service.latencyMs)} aria-label={'Latencia de ' + service.name} />
        <p>{service.message}</p>
      </article>)}
    </div>
  </section>;
}
