import { safeFormatIsoDate } from '@/domain/game-detail-resilience';
import { fetchGameMeta } from '@/services/game-meta-service';
import { formatGameHours, sanitizeVideoUrl, type GameMetaReport } from '@/domain/game-meta';
import '@/styles/game-meta-hub.css';

export function GameMetaView({ title, data }: { title: string; data: GameMetaReport }) {
  if (!data) return null;
  const { duration, proton, speedrun } = data;
  if (!duration && !proton && !speedrun) return null;
  const durations = [
    ['Historia principal', duration?.mainStoryHours, 'story'],
    ['Historia + extras', duration?.mainExtraHours, 'extras'],
    ['Completista · 100%', duration?.completionistHours, 'complete'],
  ] as const;
  const maximum = Math.max(
    1,
    ...durations.map(([, hours]) =>
      typeof hours === 'number' && Number.isFinite(hours) ? Math.max(0, hours) : 0,
    ),
  );
  const speedrunDate = safeFormatIsoDate(speedrun?.dateIso);
  const videoUrl = sanitizeVideoUrl(speedrun?.videoUrl);
  return (
    <section className="game-meta-hub" aria-label={`Inteligencia de juego de ${title}`}>
      <header className="game-meta-header">
        <div>
          <p className="eyebrow">GAME META INTELLIGENCE // ARCHIVO TÁCTICO</p>
          <h2>Conoce tu próxima misión.</h2>
        </div>
        <span className="game-meta-cache">ACTUALIZACIÓN · 24 H</span>
      </header>
      <div className="game-meta-grid">
        {duration && (
          <article className="game-meta-card game-meta-duration">
            <p className="game-meta-eyebrow">⏳ DURÓMETRO // IGDB</p>
            <h3>Tu tiempo, tu aventura.</h3>
            <dl>
              {durations.map(([label, hours, kind]) => (
                <div key={kind} className="game-meta-duration-row" data-duration={kind}>
                  <div>
                    <dt>{label}</dt>
                    <dd>{hours != null ? formatGameHours(hours * 3600) : 'Sin registros'}</dd>
                  </div>
                  <div className="game-meta-duration-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${typeof hours === 'number' && Number.isFinite(hours) ? Math.min(100, Math.max(0, (hours / maximum) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </dl>
            <p className="muted">
              Estimaciones comunitarias de IGDB. El tiempo varía según tu estilo.
            </p>
            <a
              href={`https://howlongtobeat.com/?q=${encodeURIComponent(title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="game-meta-link"
            >
              Comparar en HowLongToBeat ↗
            </a>
          </article>
        )}
        {proton && (
          <article className="game-meta-card game-meta-proton">
            <p className="game-meta-eyebrow">🎮 PROTONDB // LINUX & DECK</p>
            <h3>Compatibilidad comunitaria</h3>
            <div className="game-meta-tier" data-tier={proton.tier}>
              <span aria-hidden="true">◆</span>{' '}
              {typeof proton.tier === 'string' ? proton.tier.toUpperCase() : 'PENDING'}
            </div>
            {proton.steamDeckVerified && (
              <span className="game-meta-deck">🎮 Steam Deck Ready*</span>
            )}
            <p className="game-meta-reports">
              {(typeof proton.totalReports === 'number' && Number.isFinite(proton.totalReports)
                ? Math.max(0, proton.totalReports)
                : 0
              ).toLocaleString('es-CL')}{' '}
              reportes
            </p>
            <p className="muted">
              {proton.steamDeckVerified
                ? '*Orientación por tier Gold/Platinum. No equivale a la certificación de Valve ni garantiza FPS.'
                : 'Reportes de Linux/Proton; consulta los requisitos y experiencias del juego.'}
            </p>
            <a
              href={proton.protonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="game-meta-link"
            >
              Ver reporte en ProtonDB ↗
            </a>
          </article>
        )}
        {speedrun && (
          <article className="game-meta-card game-meta-speedrun">
            <p className="game-meta-eyebrow">🏆 SPEEDRUN.COM // WORLD RECORD</p>
            <h3>
              {typeof speedrun.categoryName === 'string'
                ? speedrun.categoryName
                : 'Categoría no disponible'}
            </h3>
            <strong className="game-meta-record">
              {typeof speedrun.timeFormatted === 'string' ? speedrun.timeFormatted : '—'}
            </strong>
            <p className="game-meta-runner">
              por{' '}
              {typeof speedrun.runnerName === 'string'
                ? speedrun.runnerName
                : 'Corredor no disponible'}
            </p>
            {speedrunDate && <time dateTime={speedrun.dateIso ?? undefined}>{speedrunDate}</time>}
            <div className="game-meta-actions">
              {videoUrl && (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button outline small"
                >
                  ▶ Ver carrera en video ↗
                </a>
              )}
              <a
                href={speedrun.speedrunUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="game-meta-link"
              >
                Consultar clasificación ↗
              </a>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
export async function GameMetaHub({ title, igdbId }: { title: string; igdbId?: number | null }) {
  let data: GameMetaReport | null = null;
  try {
    data = await fetchGameMeta(title, igdbId);
  } catch {
    return null;
  }
  if (!data || (!data.duration && !data.proton && !data.speedrun)) return null;
  return <GameMetaView title={title} data={data} />;
}
