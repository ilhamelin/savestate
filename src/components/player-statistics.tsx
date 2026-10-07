import { playerStatistics } from '@/domain/statistics';
import type { UserGame, Game, PlayLog } from '@/domain/model';
export function PlayerStatistics({
  entries,
  games,
  logs,
}: {
  entries: UserGame[];
  games: Game[];
  logs: PlayLog[];
}) {
  const stats = playerStatistics(entries, games, logs);
  return (
    <section id="player-stats" className="panel">
      <h2>Estadísticas del jugador</h2>
      <div className="form-row">
        <div>
          <h3>Géneros más jugados</h3>
          {stats.genres.slice(0, 5).map(([genre, hours]) => (
            <div className="log-entry" key={genre}>
              <span>
                {genre} · {hours.toFixed(1)} h
              </span>
              <meter
                min={0}
                max={stats.genres[0]?.[1] || 1}
                value={hours}
                aria-label={`Horas de ${genre}`}
              />
            </div>
          ))}
          {!stats.genres.length ? <p className="muted">Registra horas en tus partidas.</p> : null}
        </div>
        <div>
          <h3>Plataforma más jugada</h3>
          {stats.platforms.slice(0, 5).map(([platform, hours]) => (
            <div className="log-entry" key={platform}>
              <span>
                {platform} · {hours.toFixed(1)} h
              </span>
              <meter
                min={0}
                max={stats.platforms[0]?.[1] || 1}
                value={hours}
                aria-label={`Horas en ${platform}`}
              />
            </div>
          ))}
        </div>
      </div>
      <h3 style={{ marginTop: 25 }}>Balance anual de partidas</h3>
      <p className="muted">
        Horas agrupadas por año de finalización; si no terminó, por inicio o registro. Los géneros
        pueden compartir un mismo juego.
      </p>
      {stats.years.map(([year, value]) => (
        <div className="list-row" key={year}>
          <strong>{year}</strong>
          <span>
            {value.hours.toFixed(1)} h · {value.completed} partidas terminadas
          </span>
        </div>
      ))}
    </section>
  );
}
