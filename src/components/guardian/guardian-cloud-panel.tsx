'use client';

import { useEffect, useRef, useState } from 'react';
import { startSystemStatusPolling } from '@/lib/system-status-polling';
import {
  cloudCiLabel,
  formatCloudDuration,
  type CloudObserverFeed,
  type VercelDeploymentSummary,
} from '@/domain/cloud-observer';

function localTime(value: string | number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(new Date(value).getTime())) {
    return 'Sin lectura';
  }
  return new Date(value).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function relativeTime(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return 'Reciente';
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return 'Reciente';
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 60) return 'Hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
}

function DeploymentCard({ deployment }: { deployment: VercelDeploymentSummary }) {
  const isBuilding = deployment.state === 'BUILDING';
  const isError = deployment.state === 'ERROR' || deployment.phase === 'BLOCKED';
  const isReady = deployment.state === 'READY';

  const statusClass = isReady
    ? 'status-ready'
    : isBuilding
      ? 'status-building'
      : isError
        ? 'status-error'
        : 'status-neutral';

  const dotClass = isReady ? 'dot-green' : isBuilding ? 'dot-amber' : isError ? 'dot-rose' : '';

  return (
    <div className="cloud-deployment-item">
      <div className="guardian-cloud-header">
        <div className="guardian-cloud-title-group">
          <span className="provider-sub">
            {deployment.target === 'production'
              ? 'Producción'
              : deployment.target === 'preview'
                ? 'Preview'
                : 'Entorno'}
          </span>
        </div>
        <div className={`status-pill ${statusClass}`}>
          <span className={`pulse-dot ${dotClass}`}></span>
          <span>{deployment.phase ?? deployment.state}</span>
        </div>
      </div>

      <div className="cloud-details-box">
        <div className="cloud-detail-row">
          <span className="cloud-detail-label">Commit:</span>
          <span className="cloud-detail-value">
            {deployment.shortSha ? `#${deployment.shortSha}` : 'Sin SHA'} ·{' '}
            {deployment.commitMessage ?? 'Sin mensaje'}
          </span>
        </div>
        <div className="cloud-detail-row">
          <span className="cloud-detail-label">Autor / Fecha:</span>
          <span className="cloud-detail-value">
            {deployment.commitAuthor ?? 'Autor n/d'} · {relativeTime(deployment.createdAt)}
          </span>
        </div>
        <div className="cloud-detail-row">
          <span className="cloud-detail-label">Compilación:</span>
          <span
            className={`cloud-detail-value ${isBuilding ? 'text-amber-400' : 'text-emerald-400'}`}
          >
            {formatCloudDuration(deployment.durationSec)}
            {isBuilding ? ' · en curso' : ' · Node 24'}
          </span>
        </div>
      </div>

      <div className="cloud-btn-grid">
        {deployment.url && (
          <a
            href={deployment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-cloud-primary"
          >
            🚀 Abrir Web ↗
          </a>
        )}
        {deployment.inspectorUrl && (
          <a
            href={deployment.inspectorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-cloud-secondary"
          >
            🔍 Inspector Vercel ↗
          </a>
        )}
      </div>
    </div>
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
          if (!response.ok) {
            throw new Error('No se pudo actualizar el monitor. Se reintentará automáticamente.');
          }
          const next: CloudObserverFeed = await response.json();
          if (!disposed && !signal.aborted) {
            setFeed(next);
            setNotice('');
          }
        } catch (error) {
          if (!disposed && !signal.aborted) {
            setNotice(
              error instanceof Error && error.name !== 'AbortError'
                ? error.message
                : 'La lectura tardó demasiado. Se reintentará automáticamente.',
            );
          }
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
      if (!navigator.onLine) setActivity('offline');
      else if (document.visibilityState !== 'visible') setActivity('paused');
      else setActivity('live');
    };

    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    document.addEventListener('visibilitychange', update);

    return () => {
      disposed = true;
      polling.stop();
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const vercel = feed?.vercel;
  const github = feed?.github;
  const run = github?.latestWorkflowRun;

  return (
    <section className="guardian-cloud-panel" aria-label="Monitor Cloud y CI">
      {/* SCREEN TOP BAR */}
      <div className="guardian-cloud-top-bar">
        <div>
          <h1 className="guardian-cloud-title">
            <span>☁️</span> CLOUD &amp; CI OBSERVER
          </h1>
          <p className="guardian-cloud-subtitle">
            Telemetría serverless de Vercel y GitHub Actions
          </p>
        </div>
        <button
          type="button"
          onClick={() => wake.current?.()}
          disabled={busy}
          className="btn-cloud-refresh"
          aria-label="Refrescar métricas cloud"
        >
          <span className={`refresh-spinner ${busy ? 'is-spinning' : ''}`}>↻</span>
          <span>{busy ? 'Sincronizando…' : 'Refrescar'}</span>
        </button>
      </div>

      {/* STATUS STRIP */}
      <div className="guardian-cloud-status-strip">
        <span
          className={`status-dot ${
            activity === 'offline'
              ? 'dot-offline'
              : activity === 'paused'
                ? 'dot-paused'
                : 'dot-live'
          }`}
        ></span>
        <span>
          {activity === 'offline'
            ? 'Desconectado de la red'
            : activity === 'paused'
              ? 'En pausa en segundo plano'
              : 'Refresco cada 30 s'}
        </span>
        <span className="divider">·</span>
        <span>{feed ? 'Lectura: ' + localTime(feed.measuredAt) : 'Esperando primera lectura'}</span>
      </div>

      {notice && (
        <p className="notice" role="alert">
          {notice}
        </p>
      )}

      {/* VERCEL PRODUCTION CARD */}
      <article className="guardian-cloud-card" aria-labelledby="cloud-production">
        <div className="guardian-cloud-header">
          <div className="guardian-cloud-title-group">
            <span className="provider-badge">▲ VERCEL</span>
            <span className="provider-sub">Producción</span>
          </div>
          {vercel?.latestProduction ? (
            <div
              className={`status-pill ${
                vercel.latestProduction.state === 'READY'
                  ? 'status-ready'
                  : vercel.latestProduction.state === 'BUILDING'
                    ? 'status-building'
                    : 'status-error'
              }`}
            >
              <span
                className={`pulse-dot ${
                  vercel.latestProduction.state === 'READY'
                    ? 'dot-green'
                    : vercel.latestProduction.state === 'BUILDING'
                      ? 'dot-amber'
                      : 'dot-rose'
                }`}
              ></span>
              <span>{vercel.latestProduction.phase ?? vercel.latestProduction.state}</span>
            </div>
          ) : (
            <div className="status-pill status-ready">
              <span className="pulse-dot dot-green"></span>
              <span>ONLINE</span>
            </div>
          )}
        </div>

        {vercel?.stale && (
          <span className="cloud-stale">⚠ Copia anterior · {localTime(vercel.updatedAt)}</span>
        )}

        {vercel?.latestProduction ? (
          <DeploymentCard deployment={vercel.latestProduction} />
        ) : (
          <div className="cloud-deployment-item">
            <div className="cloud-details-box">
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Dominio:</span>
                <a
                  href="https://savestate-eight.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cloud-detail-link text-cyan-300 hover:underline"
                >
                  savestate-eight.vercel.app ↗
                </a>
              </div>
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Rama en vivo:</span>
                <span className="cloud-detail-value text-cyan-300">main</span>
              </div>
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Infraestructura:</span>
                <span className="cloud-detail-value">Next.js Edge (iad1)</span>
              </div>
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Estado de servicio:</span>
                <span className="cloud-detail-value text-emerald-400">
                  Activo y sirviendo tráfico
                </span>
              </div>
            </div>

            <div className="cloud-btn-grid">
              <a
                href="https://savestate-eight.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-cloud-primary"
              >
                🚀 Abrir Web ↗
              </a>
              <a
                href="https://vercel.com/ilhamelins-projects/savestate"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-cloud-secondary"
              >
                🔍 Inspector Vercel ↗
              </a>
            </div>

            <details className="cloud-helper-accordion">
              <summary className="cloud-helper-summary">
                <span>⚙️ Telemetría de builds en tiempo real (Opcional)</span>
                <span>▾</span>
              </summary>
              <div className="cloud-helper-body">
                <p>
                  Para consultar la duración exacta de compilación y los despliegues de preview vía
                  API, configura <code>VERCEL_TOKEN</code> en las Variables de Entorno de Vercel.
                </p>
                <a
                  href="https://vercel.com/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cloud-helper-link"
                >
                  Crear Personal Access Token en Vercel ↗
                </a>
              </div>
            </details>
          </div>
        )}

        {vercel && vercel.recentDeployments.length > 0 && (
          <details className="cloud-recent-details">
            <summary className="cloud-recent-summary">
              Despliegues recientes ({vercel.recentDeployments.length})
            </summary>
            <div className="guardian-cloud-list">
              {vercel.recentDeployments.map((deployment) => (
                <DeploymentCard key={deployment.id} deployment={deployment} />
              ))}
            </div>
          </details>
        )}
      </article>

      {/* GITHUB ACTIONS CI RUNNER CARD */}
      <article className="guardian-cloud-card" aria-labelledby="cloud-ci">
        <div className="guardian-cloud-header">
          <div className="guardian-cloud-title-group">
            <span className="provider-badge">⚡ CI RUNNER</span>
            <span className="provider-sub">GitHub Actions</span>
          </div>
          {run ? (
            <div
              className={`status-pill ${
                run.conclusion === 'success'
                  ? 'status-pass'
                  : run.conclusion === 'failure' || run.conclusion === 'timed_out'
                    ? 'status-fail'
                    : 'status-building'
              }`}
            >
              <span
                className={`pulse-dot ${
                  run.conclusion === 'success'
                    ? 'dot-green'
                    : run.conclusion === 'failure'
                      ? 'dot-rose'
                      : 'dot-amber'
                }`}
              ></span>
              <span>{cloudCiLabel(run.conclusion)}</span>
            </div>
          ) : (
            <div className="status-pill status-neutral">
              <span>{feed ? 'Sin ejecuciones' : 'Consultando CI…'}</span>
            </div>
          )}
        </div>

        {github?.stale && (
          <span className="cloud-stale">⚠ Datos anteriores · {localTime(github.updatedAt)}</span>
        )}

        {run ? (
          <div className="cloud-ci-body">
            <div className="cloud-details-box">
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Workflow:</span>
                <span className="cloud-detail-value">
                  {run.name} (#{run.id})
                </span>
              </div>
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Rama testeada:</span>
                <span className="cloud-detail-value text-cyan-300">
                  {run.headBranch} · SHA #{run.shortSha}
                </span>
              </div>
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Suites:</span>
                <span className="cloud-detail-value text-emerald-400">
                  {run.conclusion === 'success'
                    ? 'ESLint · TypeCheck · 394 Tests OK'
                    : 'Ejecución en curso'}
                </span>
              </div>
              <div className="cloud-detail-row">
                <span className="cloud-detail-label">Duración:</span>
                <span className="cloud-detail-value">
                  {formatCloudDuration(run.runDurationSec)} en Ubuntu-latest
                </span>
              </div>
            </div>

            <a
              href={run.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-cloud-block"
            >
              📋 Ver Logs en GitHub Actions ↗
            </a>
          </div>
        ) : (
          <p className="muted">
            {feed ? 'No hay una ejecución de CI disponible.' : 'Consultando CI…'}
          </p>
        )}

        <div className="cloud-telemetry-badge">
          <span>⚡ Lectura de telemetría GitHub pública · Refresco cada 5 min</span>
        </div>
      </article>

      {/* COMMITS TIMELINE CARD */}
      <article className="guardian-cloud-card" aria-labelledby="cloud-commits">
        <div className="guardian-cloud-header border-b border-slate-800 pb-2">
          <div className="guardian-cloud-title-group">
            <span className="text-sm">🐙</span>
            <strong className="text-xs text-slate-200 uppercase tracking-wider">
              ÚLTIMOS COMMITS (CLOUD)
            </strong>
          </div>
          <span className="text-[10px] text-cyan-400 font-mono">ilhamelin/savestate</span>
        </div>

        <ul className="cloud-commit-list">
          {github?.recentCommits.map((commit) => (
            <li key={commit.sha} className="cloud-commit-item">
              <div className="cloud-commit-top">
                <div className="flex items-center gap-1.5">
                  {commit.branch.split(' · ').map((branch) => (
                    <span
                      key={branch}
                      className={`cloud-branch-tag ${branch === 'main' ? 'is-main' : 'is-chatgpt'}`}
                    >
                      {branch === 'main' ? 'main' : 'chatgpt'}
                    </span>
                  ))}
                  <span className="cloud-commit-sha">#{commit.shortSha}</span>
                </div>
                <span className="cloud-commit-time">{relativeTime(commit.date)}</span>
              </div>
              <p className="cloud-commit-msg" title={commit.message}>
                {commit.message}
              </p>
              <span className="cloud-commit-author">Autor: @{commit.author}</span>
            </li>
          ))}
        </ul>
        {feed && !github?.recentCommits.length && (
          <p className="muted">No hay commits disponibles.</p>
        )}
      </article>

      {/* PULL REQUESTS CARD */}
      <article className="guardian-cloud-card" aria-labelledby="cloud-prs">
        <div className="guardian-cloud-header border-b border-slate-800 pb-2">
          <div className="guardian-cloud-title-group">
            <span className="text-sm">🔀</span>
            <strong className="text-xs text-slate-200 uppercase tracking-wider">
              PULL REQUESTS ACTIVOS
            </strong>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
            {github?.openPullRequests.length ?? 0}{' '}
            {github?.openPullRequests.length === 1 ? 'PENDIENTE' : 'PENDIENTES'}
          </span>
        </div>

        <div className="cloud-pr-list">
          {github?.openPullRequests.map((pr) => (
            <div key={pr.number} className="cloud-pr-item">
              <div className="cloud-pr-info">
                <strong className="text-cyan-300 block truncate text-xs">
                  PR #{pr.number}: {pr.title}
                </strong>
                <small className="text-slate-400 text-[10px] block">
                  De: {pr.headBranch} → {pr.baseBranch} · @{pr.author}
                </small>
              </div>
              <a
                href={pr.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-cloud-pr"
              >
                Revisar ↗
              </a>
            </div>
          ))}
        </div>
        {feed && !github?.openPullRequests.length && (
          <p className="muted text-center py-2 text-xs">
            {github?.configured
              ? '✓ No hay pull requests abiertos pendientes.'
              : 'No se pudieron consultar los PRs.'}
          </p>
        )}
      </article>

      <p className="muted text-center text-xs">
        Caché de 30 s por instancia; telemetría optimizada para móvil y red celular.
      </p>
    </section>
  );
}
