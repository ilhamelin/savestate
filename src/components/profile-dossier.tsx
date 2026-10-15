import { resolvePlatformIcon } from '@/domain/platform-icons';
import Image from 'next/image';
import Link from 'next/link';
import type { ProfileDossier } from '@/domain/dossier';
import { STATUS_LABELS } from '@/domain/model';
import { NumberTicker } from '@/components/ui/number-ticker';
export function HardwareBadges({
  platforms,
  isOwner = false,
}: {
  platforms: string[];
  isOwner?: boolean;
}) {
  return (
    <section className="panel hardware-showcase">
      <p className="eyebrow">HARDWARE INVENTORY</p>
      <div className="hardware-heading">
        <h2>Mis consolas y hardware</h2>
        <span className="tag">
          {platforms.length} {platforms.length === 1 ? 'estación' : 'estaciones'}
        </span>
      </div>
      <div className="hardware-cards-grid">
        {platforms.map((platform) => {
          const icon = resolvePlatformIcon(platform);
          return (
            <div className="hardware-card" key={platform}>
              <span className="hardware-card-identity">
                {icon ? (
                  <Image src={icon} alt="" width={22} height={22} unoptimized />
                ) : (
                  <span aria-hidden="true">▣</span>
                )}
                <strong>{platform}</strong>
              </span>
              <small className="hardware-system-badge" title="Hardware declarado por el jugador">
                ● Sistema verificado
              </small>
            </div>
          );
        })}
        {isOwner && (
          <Link className="hardware-card-add" href="/settings">
            <strong>➕ Vincular otra consola</strong>
            <small>Configura PlayStation, Xbox o Switch en Ajustes →</small>
          </Link>
        )}
      </div>
      {!platforms.length ? <p className="muted">Todavía no hay plataformas declaradas.</p> : null}
    </section>
  );
}
export function StatsDossier({ stats }: { stats: ProfileDossier }) {
  const labels: Record<string, string> = {
    hardware: 'Hardware original',
    emulator: 'Emulación',
    other: 'Otros métodos',
  };
  return (
    <section id="player-dossier" className="panel metrics-dossier">
      <p className="eyebrow">PLAYER METRICS / ALL CHECKPOINTS</p>
      <h2>Dossier de métricas</h2>
      <div className="stats-grid">
        <div className="stat">
          <strong>
            <NumberTicker value={stats.clearRate} decimals={1} />%
          </strong>
          <span>
            Clear Rate · {stats.completed} de {stats.started} empezados
          </span>
        </div>
        <div className="stat">
          <strong>
            <NumberTicker value={stats.hours} decimals={1} /> h
          </strong>
          <span>Horas totales</span>
        </div>
        <div className="stat">
          <strong>
            <NumberTicker value={stats.averageCompletedHours} decimals={1} /> h
          </strong>
          <span>Promedio por juego completado</span>
        </div>
      </div>
      <p className="muted">
        Completados: Cleared y Platinum. El Clear Rate excluye Wishlist y Backlog sin iniciar.
        Incluye las horas de Steam y rejugadas.
      </p>
      <h3>Termómetro del backlog</h3>
      <div className="backlog-thermometer" aria-hidden="true">
        {stats.states
          .filter((state) => state.count)
          .map((state) => (
            <span
              key={state.status}
              className={`state-${state.status}`}
              style={{ width: `${state.percent}%` }}
            />
          ))}
      </div>
      <ul className="dossier-legend">
        {stats.states.map((state) => (
          <li key={state.status}>
            <span className={`state-dot state-${state.status}`} aria-hidden="true" />
            {STATUS_LABELS[state.status]}: {state.count} · {state.percent.toFixed(1)}%
          </li>
        ))}
      </ul>
      <div className="form-row">
        <div>
          <h3>Ecosistema de plataformas</h3>
          <p className="muted">Top 3 por horas registradas.</p>
          {stats.platforms.slice(0, 3).map((platform) => (
            <div className="log-entry" key={platform.name}>
              <span>
                {platform.name} · {platform.hours.toFixed(1)} h · {platform.percent.toFixed(1)}%
              </span>
              <meter
                min={0}
                max={100}
                value={platform.percent}
                aria-label={`Porcentaje de horas en ${platform.name}`}
              />
            </div>
          ))}
          {!stats.platforms.length ? (
            <p className="muted">Registra una partida para descubrir tu ecosistema.</p>
          ) : null}
        </div>
        <div>
          <h3>Hardware vs emulación</h3>
          <p className="muted">Porcentaje de partidas; otros métodos se muestran aparte.</p>
          {stats.methods.map((method) => (
            <div className="log-entry" key={method.method}>
              <span>
                {labels[method.method]} · {method.count} partidas · {method.hours.toFixed(1)} h ·{' '}
                {method.percent.toFixed(1)}%
              </span>
              <meter
                min={0}
                max={100}
                value={method.percent}
                aria-label={`Porcentaje de partidas: ${labels[method.method]}`}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
