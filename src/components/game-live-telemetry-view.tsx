import Image from 'next/image';
import { formatClpPrice, type GameLiveTelemetry } from '@/domain/game-live-telemetry';
import '@/styles/game-live-radar.css';

export interface GameLiveTelemetryViewProps {
  title: string;
  data: GameLiveTelemetry;
}

export function GameLiveTelemetryView({ title, data }: GameLiveTelemetryViewProps) {
  const streams = data.twitchStreams.slice(0, 4);
  const noData = data.steamCurrentPlayers === null && !data.deals.length && !streams.length;
  return (
    <section className="panel game-live-radar" aria-label="Telemetría en vivo y ofertas">
      <header className="radar-header">
        <div>
          <p className="eyebrow"><span aria-hidden="true">📡</span> LIVE GAME RADAR // CACHÉ 5 MIN</p>
          <h2>El pulso de {title}</h2>
        </div>
        <span className="radar-system-status">{noData && !data.historicalLow ? 'SYS: SIN DATOS' : 'SYS: ACTIVE'}</span>
      </header>
      {noData && (
        <p className="notice">
          No hay datos disponibles para este título en este momento. Prueba otra búsqueda.
        </p>
      )}
      <div className="radar-stats-cluster">
        <article className="radar-stat-card" data-metric="steam">
          <p className="radar-stat-label">{data.steamCurrentPlayers !== null && <span className="radar-live-dot" aria-hidden="true" />} STEAM PLAYERS</p>
          <strong>{data.steamCurrentPlayers === null ? 'Sin datos' : data.steamCurrentPlayers.toLocaleString('es-CL')}</strong>
          <small>jugando ahora en Steam</small>
        </article>
        <article className="radar-stat-card" data-metric="twitch">
          <p className="radar-stat-label">{streams.length > 0 && <span className="radar-live-dot" aria-hidden="true" />} TWITCH VIEWERS</p>
          <strong>{data.twitchTotalTopViewers.toLocaleString('es-CL')}</strong>
          <small>{streams.length ? 'espectadores en directo (Top 4)' : 'Sin transmisiones en directo'}</small>
        </article>
        <article className="radar-stat-card" data-metric="low">
          <p className="radar-stat-label"><span aria-hidden="true">🏷️</span> ALL-TIME LOW</p>
          <strong>{data.historicalLow ? '$' + data.historicalLow.price + ' USD' : 'Sin registro'}</strong>
          {data.historicalLow && <small className="radar-clp-price">{formatClpPrice(data.historicalLow.price, data.usdToClpRate)}</small>}
          <small>mínimo histórico registrado</small>
        </article>
      </div>
      <section className="radar-deals-section" aria-label="Ofertas PC">
        <div className="radar-section-heading">
          <h3>🏷️ Ofertas PC · USD &amp; CLP</h3>
          {data.usdToClpRate != null && Number.isFinite(data.usdToClpRate) && data.usdToClpRate > 0 && (
            <small className="radar-rate">💱 Tasa ref: 1 USD ≈ ${Math.round(data.usdToClpRate).toLocaleString('es-CL')} CLP</small>
          )}
        </div>
        <div className="radar-deals-container">
          {data.deals.slice(0, 4).map((deal) => (
            <article className="radar-deal-row" key={deal.dealId}>
              <div className="radar-store-identity">
                <span className="radar-store-badge" data-store={deal.storeName.toLowerCase()}>{deal.storeName}</span>
                <small>{deal.savingsPercent > 0 ? 'Oferta PC' : 'Sin descuento'}</small>
              </div>
              <div className="radar-price-block">
                {deal.savingsPercent > 0 && (
                  <>
                    <del className="radar-original-price">
                      ${deal.normalPrice} USD
                      <small className="radar-clp-price">{formatClpPrice(deal.normalPrice, data.usdToClpRate)}</small>
                    </del>
                    <span className="radar-savings-tag">-{deal.savingsPercent}%</span>
                  </>
                )}
                <span className="radar-current-price">
                  <strong>${deal.salePrice} USD</strong>
                  <small className="radar-clp-price">{formatClpPrice(deal.salePrice, data.usdToClpRate)}</small>
                </span>
              </div>
              <a className="button outline small" href={deal.dealUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ver oferta de ${deal.storeName}`}>Ver oferta ↗</a>
            </article>
          ))}
          <article className="radar-deal-row radar-instant-gaming-row">
            <div className="radar-store-identity">
              <strong>Instant Gaming</strong>
              <span className="radar-store-badge" data-store="instant-gaming">KEYSHOP</span>
              <small>Claves digitales PC</small>
            </div>
            <div className="radar-price-block"><span className="radar-keyshop-search">Comparar mejor oferta</span></div>
            <a className="button outline small" href={`https://www.instant-gaming.com/es/busqueda/?q=${encodeURIComponent(title)}`} target="_blank" rel="noopener noreferrer" aria-label="Buscar ofertas en Instant Gaming">Ver oferta ↗</a>
          </article>
        </div>
      </section>
      {streams.length > 0 && (
        <section className="radar-streams-section" aria-label="Transmisiones de Twitch">
          <div className="radar-section-heading"><h3>📺 Twitch Live Radar</h3><small>Transmisiones en vivo · Top 4</small></div>
          <div className="radar-streams-grid">
            {streams.map((stream) => (
              <a key={stream.id} href={stream.streamUrl} target="_blank" rel="noopener noreferrer" className="radar-stream-card">
                <div className="radar-stream-thumb">
                  {stream.thumbnailUrl && <Image src={stream.thumbnailUrl} alt="" width={320} height={180} unoptimized loading="lazy" />}
                  <span className="radar-stream-viewers">🔴 EN VIVO · {stream.viewerCount.toLocaleString('es-CL')} esp.</span>
                </div>
                <div className="radar-stream-copy">
                  <strong>{stream.userName}</strong>
                  <p title={stream.title}>{stream.title}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
      <p className="radar-footer">
        <span aria-hidden="true">ℹ️</span>
        <span>Disponibilidad y precios sujetos a la tienda y región. Datos externos actualizados cada cinco minutos. Conversión CLP aproximada con tasa horaria de <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">ExchangeRate-API</a>; respaldo de 975 CLP por USD si el servicio no está disponible.</span>
      </p>
    </section>
  );
}
