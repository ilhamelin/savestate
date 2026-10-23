'use client';
import { useEffect, useRef, useState } from 'react';
import { startSystemStatusPolling } from '@/lib/system-status-polling';
import {
  cloudCiLabel,
  formatCloudDuration,
  type CloudObserverFeed,
  type VercelDeploymentSummary,
} from '@/domain/cloud-observer';

function localTime(value: string | number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(new Date(value).getTime()))
    return 'Sin lectura';
  return new Date(value).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
function DeploymentCard({ deployment }: { deployment: VercelDeploymentSummary }) {
  const state = deployment.phase ?? deployment.state;
  return (
    <article className="guardian-cloud-entry">
      <div className="guardian-cloud-row">
        <span
          className={'cloud-state cloud-state-' + deployment.state.toLowerCase()}
          data-building={deployment.state === 'BUILDING' ? 'true' : undefined}
        >
          {state}
        </span>
        <small>
          {deployment.target === 'production'
            ? 'Producción'
            : deployment.target === 'preview'
              ? 'Preview'
              : 'Entorno sin confirmar'}
        </small>
      </div>
      <strong>
        {deployment.shortSha ?? 'Sin commit'} ·{' '}
        {deployment.commitMessage ?? 'Despliegue sin mensaje'}
      </strong>
      <small>
        {deployment.commitAuthor ?? 'Autor no disponible'} · {localTime(deployment.createdAt)}
      </small>
      <p className="muted">
        Compilación: {formatCloudDuration(deployment.durationSec)}
        {deployment.state === 'BUILDING' ? ' · en curso' : ''}
      </p>
      <div className="guardian-cloud-links">
        {deployment.url && (
          <a href={deployment.url} target="_blank" rel="noopener noreferrer">
            Abrir web ↗
          </a>
        )}
        {deployment.inspectorUrl && (
          <a href={deployment.inspectorUrl} target="_blank" rel="noopener noreferrer">
            Inspector Vercel ↗
          </a>
        )}
      </div>
    </article>
  );
}
export function GuardianCloudPanel() {
  const [feed, setFeed] = useState<CloudObserverFeed | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [activity, setActivity] = useState<'live' | 'paused' | 'offline'>('live');
  const wake = useRef<(() => void) | null>(null);
  useEffect(() => {
    let disposed = false;
    const isActive = () => navigator.onLine && document.visibilityState === 'visible';
    const polling = startSystemStatusPolling({
      isActive,
      schedule(callback, delay) {
        const id = window.setTimeout(callback, delay);
        return () => window.clearTimeout(id);
      },
      async refresh(signal) {
        setBusy(true);
        const controller = new AbortController();
        const cancel = () => controller.abort();
        signal.addEventListener('abort', cancel, { once: true });
        const timeout = window.setTimeout(cancel, 10000);
        try {
          if (signal.aborted) return;
          const response = await fetch('/api/guardian/cloud-feed', {
            cache: 'no-store',
            signal: controller.signal,
          });
          if (response.status === 401 || response.status === 403) {
            if (!disposed && !signal.aborted) setFeed(null);
            throw new Error('Vuelve a iniciar sesión como operador para consultar la nube.');
          }
          if (!response.ok)
            throw new Error('No se pudo actualizar el monitor. Se reintentará automáticamente.');
          const next: CloudObserverFeed = await response.json();
          if (!disposed && !signal.aborted) {
            setFeed(next);
            setNotice('');
          }
        } catch (error) {
          if (!disposed && !signal.aborted)
            setNotice(
              error instanceof Error && error.name !== 'AbortError'
                ? error.message
                : 'La lectura tardó demasiado. Se reintentará automáticamente.',
            );
          throw error;
        } finally {
          clearTimeout(timeout);
          signal.removeEventListener('abort', cancel);
          if (!disposed) setBusy(false);
        }
      },
    });
    wake.current = polling.wake;
    const update = () => {
      setActivity(
        !navigator.onLine ? 'offline' : document.visibilityState === 'visible' ? 'live' : 'paused',
      );
      polling.wake();
    };
    const initial = window.setTimeout(update, 0);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      disposed = true;
      wake.current = null;
      clearTimeout(initial);
      polling.stop();
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const github = feed?.github,
    vercel = feed?.vercel,
    run = github?.latestWorkflowRun;
  return (
    <section className="guardian-cloud-panel" aria-label="Monitor Cloud y CI" aria-busy={busy}>
      <div className="guardian-cloud-row">
        <p className="eyebrow">CLOUD OBSERVER // SOLO LECTURA</p>
        <button
          type="button"
          className="button outline small"
          disabled={busy || activity !== 'live'}
          onClick={() => wake.current?.()}
        >
          {busy ? 'Consultando…' : '↻ Refrescar ahora'}
        </button>
      </div>
      <p className="muted" role="status">
        {activity === 'offline'
          ? '○ Sin conexión'
          : activity === 'paused'
            ? '◐ Consultas en pausa'
            : '● Refresco cada 30 s'}
        {' · '}
        {feed ? 'Lectura del monitor: ' + localTime(feed.measuredAt) : 'Esperando primera lectura'}
      </p>
      {notice && (
        <p className="notice" role="alert">
          {notice}
        </p>
      )}
      <section className="guardian-cloud-card" aria-labelledby="cloud-production">
        <h2 id="cloud-production">▲ Vercel · Producción</h2>
        <p className="muted">
          Último intento de producción; puede diferir de la versión que está sirviendo tráfico.
        </p>
        {vercel?.notice && <p className="notice">{vercel.notice}</p>}
        {vercel?.stale && (
          <span className="cloud-stale">⚠ Copia anterior · {localTime(vercel.updatedAt)}</span>
        )}
        {vercel?.latestProduction ? (
          <DeploymentCard deployment={vercel.latestProduction} />
        ) : (
          <p className="muted">
            {feed ? 'Sin despliegue de producción disponible.' : 'Consultando Vercel…'}
          </p>
        )}
        <details>
          <summary>Despliegues recientes ({vercel?.recentDeployments.length ?? 0})</summary>
          <div className="guardian-cloud-list">
            {vercel?.recentDeployments.map((deployment) => (
              <DeploymentCard key={deployment.id} deployment={deployment} />
            ))}
          </div>
        </details>
      </section>
      <section className="guardian-cloud-card" aria-labelledby="cloud-ci">
        <h2 id="cloud-ci">⚡ GitHub Actions · CI Runner</h2>
        {github?.notice && <p className="notice">{github.notice}</p>}
        {github?.stale && (
          <span className="cloud-stale">⚠ Datos anteriores · {localTime(github.updatedAt)}</span>
        )}
        {run ? (
          <div className="guardian-cloud-entry">
            <span className={'cloud-state cloud-ci-' + run.conclusion}>
              {cloudCiLabel(run.conclusion)}
            </span>
            <strong>{run.name}</strong>
            <p>
              {run.headBranch} · {run.shortSha} · {formatCloudDuration(run.runDurationSec)}
            </p>
            <small>{localTime(run.updatedAt)}</small>
            <a href={run.htmlUrl} target="_blank" rel="noopener noreferrer">
              Abrir logs del runner ↗
            </a>
          </div>
        ) : (
          <p className="muted">
            {feed ? 'No hay una ejecución de CI disponible.' : 'Consultando CI…'}
          </p>
        )}
      </section>
      <section className="guardian-cloud-card" aria-labelledby="cloud-commits">
        <h2 id="cloud-commits">⌘ Últimos commits</h2>
        <small className="muted">Datos de GitHub: {localTime(github?.updatedAt)}</small>
        <ul className="guardian-cloud-list">
          {github?.recentCommits.map((commit) => (
            <li key={commit.sha} className="guardian-cloud-entry">
              <div className="guardian-cloud-row">
                {commit.branch.split(' · ').map((branch) => (
                  <span
                    key={branch}
                    className={'cloud-branch ' + (branch === 'main' ? 'is-main' : 'is-chatgpt')}
                  >
                    {branch === 'main' ? 'main' : 'chatgpt'}
                  </span>
                ))}
              </div>
              <a href={commit.url} target="_blank" rel="noopener noreferrer">
                {commit.shortSha} · {commit.message}
              </a>
              <small>
                {commit.author} · {localTime(commit.date)}
              </small>
            </li>
          ))}
        </ul>
        {feed && !github?.recentCommits.length && (
          <p className="muted">No hay commits disponibles.</p>
        )}
      </section>
      <section className="guardian-cloud-card" aria-labelledby="cloud-prs">
        <h2 id="cloud-prs">⑂ Pull Requests activos</h2>
        <ul className="guardian-cloud-list">
          {github?.openPullRequests.map((pr) => (
            <li key={pr.number} className="guardian-cloud-entry">
              <a href={pr.htmlUrl} target="_blank" rel="noopener noreferrer">
                #{pr.number} · {pr.title}
              </a>
              <small>
                @{pr.author} · {pr.headBranch} → {pr.baseBranch}
              </small>
              <small>
                {pr.draft ? 'Borrador' : 'Abierto para revisión'} · {localTime(pr.createdAt)}
              </small>
            </li>
          ))}
        </ul>
        {feed && !github?.openPullRequests.length && (
          <p className="muted">
            {github?.configured
              ? 'Sin PRs abiertos disponibles en esta lectura.'
              : 'No se pudieron consultar los PRs.'}
          </p>
        )}
      </section>
      <p className="muted">
        Caché de 30 s por instancia; los datos públicos de GitHub se consultan cada 5 min para
        cuidar su cuota.
      </p>
    </section>
  );
}
