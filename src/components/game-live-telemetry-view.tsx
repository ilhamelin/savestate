import Image from 'next/image';
import type { GameLiveTelemetry } from '@/domain/game-live-telemetry';
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
            🏷️ Mínimo histórico: ${data.historicalLow.price} USD
          </span>
        )}
      </div>
      {!!data.deals.length && (
        <div>
          <h3>Ofertas PC · USD</h3>
          <div className="live-deals">
            {data.deals.slice(0, 4).map((deal) => (
              <article key={deal.dealId}>
                <strong>{deal.storeName}</strong>
                <del>${deal.normalPrice}</del>
                <span className="accent">${deal.salePrice} USD</span>
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
          </div>
        </div>
      )}
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
        cinco minutos.
      </p>
    </section>
  );
}
