import Image from 'next/image';
import { formatClpPrice, type GameLiveTelemetry } from '@/domain/game-live-telemetry';
export function GameLiveTelemetryView({ title, data }: { title: string; data: GameLiveTelemetry }) {
  return (
    <section className="panel game-live-radar" aria-label="Telemetría en vivo y ofertas">
      <p className="eyebrow">LIVE GAME RADAR // CACHÉ 5 MIN</p>
      <h2>El pulso de {title}</h2>
      {data.steamCurrentPlayers === null && !data.deals.length && !data.twitchStreams.length && (
        <p className="notice">
          No hay datos disponibles para este título en este momento. Prueba otra búsqueda.
        </p>
      )}
      <div className="tags">
        {data.steamCurrentPlayers !== null && (
          <span className="live-pill steam-pill">
            🟢 {data.steamCurrentPlayers.toLocaleString('es-CL')} jugando ahora en Steam
          </span>
        )}
        {!!data.twitchStreams.length && (
          <span className="live-pill twitch-pill">
            🔴 {data.twitchTotalTopViewers.toLocaleString('es-CL')} espectadores en Twitch (Top 4)
          </span>
        )}
        {data.historicalLow && (
          <span className="live-pill low-pill">
            🏷️ Mínimo histórico: ${data.historicalLow.price} USD{' '}
            {formatClpPrice(data.historicalLow.price, data.usdToClpRate)}
          </span>
        )}
      </div>
      <div>
        <h3>Ofertas PC · USD &amp; CLP</h3>
        {!!data.usdToClpRate && (
          <small className="muted">
            · Tasa ref: 1 USD ≈ ${Math.round(data.usdToClpRate).toLocaleString('es-CL')} CLP
          </small>
        )}
        <div className="live-deals">
          {data.deals.slice(0, 4).map((deal) => (
            <article key={deal.dealId}>
              <strong>{deal.storeName}</strong>
              <del>
                ${deal.normalPrice} USD{' '}
                <small>{formatClpPrice(deal.normalPrice, data.usdToClpRate)}</small>
              </del>
              <span className="accent">
                ${deal.salePrice} USD{' '}
                <small className="muted clp-price">
                  {formatClpPrice(deal.salePrice, data.usdToClpRate)}
                </small>
              </span>
              {deal.savingsPercent > 0 && <span className="tag">-{deal.savingsPercent}%</span>}
              <a
                className="button outline small"
                href={deal.dealUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver oferta ↗
              </a>
            </article>
          ))}
          <article className="instant-gaming-deal">
            <div className="instant-gaming-heading">
              <strong>Instant Gaming</strong>
              <span className="tag">KEYSHOP</span>
            </div>
            <span className="muted">Claves digitales PC</span>
            <span className="accent">Buscar mejor oferta</span>
            <a
              className="button outline small"
              href={`https://www.instant-gaming.com/es/busqueda/?q=${encodeURIComponent(title)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver oferta ↗
            </a>
          </article>
        </div>
      </div>
      {!!data.twitchStreams.length && (
        <div>
          <h3>Twitch Live Radar</h3>
          <div className="live-stream-grid">
            {data.twitchStreams.map((stream) => (
              <a
                key={stream.id}
                href={stream.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="live-stream-card"
              >
                <div className="live-stream-image">
                  {stream.thumbnailUrl && (
                    <Image
                      src={stream.thumbnailUrl}
                      alt=""
                      width={320}
                      height={180}
                      unoptimized
                      loading="lazy"
                    />
                  )}
                  <span className="live-pill twitch-pill">
                    🔴 EN VIVO · {stream.viewerCount.toLocaleString('es-CL')} esp.
                  </span>
                </div>
                <strong>{stream.userName}</strong>
                <p>{stream.title}</p>
              </a>
            ))}
          </div>
        </div>
      )}
      <p className="muted">
        Disponibilidad y precios sujetos a la tienda y región. Datos externos actualizados cada
        cinco minutos. Conversión CLP aproximada con tasa horaria de{' '}
        <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">
          ExchangeRate-API
        </a>
        ; respaldo de 975 CLP por USD si el servicio no está disponible.
      </p>
    </section>
  );
}
