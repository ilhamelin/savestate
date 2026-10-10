'use client';
import { useState } from 'react';
import type { FreebieItem } from '@/domain/freebies';

function FreebieImage({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="freebie-image">
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          width={320}
          height={180}
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">🎮</span>
      )}
    </div>
  );
}
export function FreebiesTracker({ freebies }: { freebies: FreebieItem[] }) {
  return (
    <section className="freebies-section" aria-labelledby="freebies-title">
      <p className="eyebrow">LOOT ALERTA // JUEGOS GRATIS ACTIVOS</p>
      <h2 id="freebies-title">Radar de Juegos Gratis</h2>
      <p className="muted">
        Títulos para reclamar y quedarte para siempre en Steam, Epic Games y GOG.
      </p>
      {freebies.length ? (
        <div className="freebies-grid">
          {freebies.map((item) => (
            <article className="freebie-card" key={item.id}>
              <div className="freebie-art">
                <FreebieImage key={item.thumbnail} src={item.thumbnail} />
                <span className="freebie-platform">[{item.platforms}]</span>
              </div>
              <div className="freebie-copy">
                <span className="freebie-worth-tag">100% OFF · Valor {item.worth}</span>
                <h3>{item.title}</h3>
                <a
                  className="button outline small"
                  href={item.openGiveawayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🎁 Reclamar gratis ↗<span className="sr-only"> (abre en otra pestaña)</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">
          No hay ofertas disponibles en este momento. Vuelve a consultar más tarde.
        </p>
      )}
      <p className="muted freebies-attribution">
        Ofertas vía{' '}
        <a href="https://www.gamerpower.com" target="_blank" rel="noopener noreferrer">
          GamerPower ↗
        </a>{' '}
        · actualización cada hora. Revisa los requisitos y la disponibilidad regional al reclamar.
      </p>
    </section>
  );
}
