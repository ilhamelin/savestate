import { fetchGameCriticAndSpecs } from '@/services/game-specs-service';
import type { GameCriticAndSpecsReport, PcRequirementSet } from '@/domain/game-specs';
import '@/styles/game-critic-and-specs.css';

function RequirementList({ specs }: { specs: PcRequirementSet | null }) {
  if (!specs) return null;
  return (
    <div className="specs-component-list">
      {specs.os && (
        <div className="specs-component-row">
          <span className="specs-component-label">🖥️ Sistema Operativo</span>
          <span className="specs-component-value">{specs.os}</span>
        </div>
      )}
      {specs.cpu && (
        <div className="specs-component-row">
          <span className="specs-component-label">⚡ Procesador (CPU)</span>
          <span className="specs-component-value">{specs.cpu}</span>
        </div>
      )}
      {specs.ram && (
        <div className="specs-component-row">
          <span className="specs-component-label">💾 Memoria RAM</span>
          <span className="specs-component-value">{specs.ram}</span>
        </div>
      )}
      {specs.gpu && (
        <div className="specs-component-row">
          <span className="specs-component-label">🎮 Tarjeta Gráfica (GPU)</span>
          <span className="specs-component-value">{specs.gpu}</span>
        </div>
      )}
      {specs.directx && (
        <div className="specs-component-row">
          <span className="specs-component-label">⚙️ DirectX</span>
          <span className="specs-component-value">{specs.directx}</span>
        </div>
      )}
      {specs.storage && (
        <div className="specs-component-row">
          <span className="specs-component-label">💽 Almacenamiento</span>
          <span className="specs-component-value">{specs.storage}</span>
        </div>
      )}
    </div>
  );
}

export function GameSpecsView({ title, data }: { title: string; data: GameCriticAndSpecsReport }) {
  if (!data || (!data.critic && !data.hardware)) return null;
  const { critic, hardware } = data;

  const getVerdictText = (tier: string) => {
    switch (tier) {
      case 'positive':
        return 'Aclamación universal de la crítica';
      case 'mixed':
        return 'Reseñas mixtas o intermedias';
      case 'negative':
        return 'Recepción desfavorable';
      default:
        return 'Puntuación en consolidación';
    }
  };

  const safeId = (title || 'game').toLowerCase().replace(/[^a-z0-9]/g, '-');

  return (
    <section className="game-specs-hub" aria-label={`Crítica y especificaciones de ${title}`}>
      <header className="game-specs-header">
        <div>
          <p className="eyebrow">CRITIC CONSENSUS &amp; PC HARDWARE // ANÁLISIS DE SISTEMA</p>
          <h2>Consenso y compatibilidad técnica.</h2>
        </div>
        <span className="game-specs-cache">ACTUALIZACIÓN · 24 H</span>
      </header>

      <div className="game-specs-grid">
        {critic && (
          <article className="game-specs-card game-specs-critic-card">
            <div className="game-specs-card-header">
              <p className="game-specs-eyebrow">
                {critic.provider === 'metacritic'
                  ? '⚖️ METACRITIC // PRENSA OFICIAL'
                  : '📊 IGDB // CRÍTICA ESPECIALIZADA'}
              </p>
            </div>
            <h3>Consenso de la Prensa</h3>

            {critic.score !== null ? (
              <div className="critic-score-row">
                <div className="critic-score-badge" data-tier={critic.tier}>
                  <span>{critic.score}</span>
                  <span className="score-label">METASCORE</span>
                </div>
                <div className="critic-meta-info">
                  <span className="critic-meta-provider">
                    {critic.provider === 'metacritic'
                      ? 'Metacritic Score Oficial'
                      : 'Prensa Agregada IGDB'}
                  </span>
                  <span className="critic-meta-verdict">{getVerdictText(critic.tier)}</span>
                </div>
              </div>
            ) : (
              <p className="muted">Puntuación numérica no disponible para este título.</p>
            )}

            {critic.reviewQuotes.length > 0 && (
              <div className="critic-quotes-list">
                {critic.reviewQuotes.map((quoteItem, idx) => (
                  <div key={idx} className="critic-quote-item">
                    <p className="critic-quote-text">“{quoteItem.quote}”</p>
                    <div className="critic-quote-attribution">
                      <span>{quoteItem.source}</span>
                      {quoteItem.score && (
                        <span className="critic-quote-score">{quoteItem.score}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {critic.url && (
              <a
                href={critic.url}
                target="_blank"
                rel="noopener noreferrer"
                className="game-specs-link"
              >
                Ver reseñas completas en Metacritic ↗
              </a>
            )}
          </article>
        )}

        {hardware && (
          <article className="game-specs-card game-specs-hardware-card">
            <div className="game-specs-card-header">
              <p className="game-specs-eyebrow">💻 REQUISITOS PC // ¿LO CORRE MI EQUIPO?</p>
            </div>
            <h3>Especificaciones de Hardware</h3>

            {hardware.isPcAvailable && (hardware.minimum || hardware.recommended) ? (
              <div className="specs-tabs-container">
                <input
                  type="radio"
                  name={`specs-tab-${safeId}`}
                  id={`tab-min-${safeId}`}
                  defaultChecked
                  className="specs-radio-min"
                />
                <input
                  type="radio"
                  name={`specs-tab-${safeId}`}
                  id={`tab-rec-${safeId}`}
                  className="specs-radio-rec"
                />
                <div className="specs-tabs" role="tablist">
                  <label htmlFor={`tab-min-${safeId}`} className="specs-tab-button tab-label-min">
                    Requisitos Mínimos
                  </label>
                  <label htmlFor={`tab-rec-${safeId}`} className="specs-tab-button tab-label-rec">
                    Requisitos Recomendados
                  </label>
                </div>

                <div className="specs-panel specs-panel-min">
                  <RequirementList specs={hardware.minimum ?? hardware.recommended} />
                </div>
                <div className="specs-panel specs-panel-rec">
                  <RequirementList specs={hardware.recommended ?? hardware.minimum} />
                </div>
              </div>
            ) : (
              <div className="specs-console-notice">
                <strong>🎮 Título de Consola / Plataforma Cerrada</strong>
                Este juego no posee versión de PC registrada en Steam. No requiere especificaciones
                de hardware de computadora.
              </div>
            )}
          </article>
        )}
      </div>
    </section>
  );
}

export async function GameCriticAndSpecsHub({
  title,
  igdbId,
}: {
  title: string;
  igdbId?: number | null;
}) {
  let data: GameCriticAndSpecsReport | null = null;
  try {
    data = await fetchGameCriticAndSpecs(title, igdbId);
  } catch {
    return null;
  }

  if (!data || (!data.critic && !data.hardware)) return null;

  return <GameSpecsView title={title} data={data} />;
}
