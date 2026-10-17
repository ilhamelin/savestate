'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GAME_ADAPTATIONS_MATRIX } from '@/domain/game-adaptations';
import type { ScreenMediaItem, ScreenRegion } from '@/domain/screen';
import { readJsonResponse } from '@/lib/api-response';
export function ScreenAdaptationsHub({
  initialItems,
  initialRegion,
  region,
  onSelect,
}: {
  initialItems: ScreenMediaItem[];
  initialRegion: ScreenRegion;
  region: ScreenRegion;
  onSelect: (item: ScreenMediaItem) => void;
}) {
  const [data, setData] = useState({ region: initialRegion, items: initialItems });
  const [error, setError] = useState('');
  useEffect(() => {
    if (region === initialRegion) return;
    const controller = new AbortController();
    fetch(`/api/screen/popular?filter=adaptations&region=${region}`, { signal: controller.signal })
      .then((response) => readJsonResponse<{ items: ScreenMediaItem[] }>(response))
      .then((result) => {
        if (!controller.signal.aborted) {
          setData({ region, items: result.items });
          setError('');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('No se pudo consultar la disponibilidad regional.');
      });
    return () => controller.abort();
  }, [region, initialRegion]);
  const items = region === initialRegion ? initialItems : data.items;
  const availabilityReady = region === initialRegion || data.region === region;
  return (
    <section className="screen-adaptations-hub" aria-labelledby="screen-adaptations-heading">
      <p className="eyebrow">DE LA CONSOLA AL STREAMING</p>
      <h2 id="screen-adaptations-heading">🎮 ADAPTACIONES DE VIDEOJUEGOS</h2>
      <p className="muted">
        Películas y series oficiales basadas en tus videojuegos favoritos. Disponibilidad en{' '}
        {region}.
      </p>
      {error && !availabilityReady && <p role="status">{error}</p>}
      <div className="screen-adaptations-track">
        {GAME_ADAPTATIONS_MATRIX.map((link) => {
          const item = items.find(
            (item) => item.tmdbId === link.tmdbId && item.mediaType === link.mediaType,
          );
          const providers = availabilityReady
            ? Array.from(
                new Map(
                  (item?.providers ?? [])
                    .filter((provider) => provider.offer === 'subscription')
                    .map((provider) => [provider.id, provider]),
                ).values(),
              )
            : [];
          return (
            <article className="screen-adaptation-card" key={`${link.mediaType}:${link.tmdbId}`}>
              <button
                type="button"
                className="screen-adaptation-select"
                disabled={!item}
                onClick={() => {
                  if (item) onSelect(item);
                }}
                aria-label={`Ver ficha de ${link.title}`}
              >
                <span className="screen-adaptation-poster">
                  {item?.posterUrl ? (
                    <Image src={item.posterUrl} alt="" width={200} height={300} unoptimized />
                  ) : (
                    <span aria-hidden="true">🎬</span>
                  )}
                </span>
                <strong>{link.title}</strong>
              </button>
              <Link
                className="screen-adaptation-game"
                href={`/games/${encodeURIComponent(link.gameSlug)}`}
              >
                🎮 {link.gameTitle} ↗
              </Link>
              <div className="screen-adaptation-providers">
                {providers.slice(0, 3).map((provider) => (
                  <a
                    key={provider.id}
                    href={provider.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {provider.name}
                  </a>
                ))}
                {!providers.length && (
                  <small className="muted">
                    {!availabilityReady
                      ? 'Consultando plataformas…'
                      : item?.source === 'demo'
                        ? 'Plataformas disponibles al conectar TMDB'
                        : 'Sin suscripción informada para esta región'}
                  </small>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
