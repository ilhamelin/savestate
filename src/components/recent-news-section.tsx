'use client';
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { LolPatchIndex } from '@/components/lol-patch-notes-hub';
const LolPatchNotesHub = dynamic(
  () => import('@/components/lol-patch-notes-hub').then((module) => module.LolPatchNotesHub),
  {
    loading: () => (
      <div className="panel skeleton" role="status">
        Cargando el hub de parches…
      </div>
    ),
  },
);
import { readJsonResponse } from '@/lib/api-response';
import type { GamingNewsItem, GamingNewsSource } from '@/domain/gaming-news';

function NewsThumbnail({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="news-thumbnail">
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="news-thumb-img"
          loading="lazy"
          decoding="async"
          width={88}
          height={50}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="news-thumb-placeholder" aria-hidden="true">
          🎮
        </span>
      )}
    </div>
  );
}

export function RecentNewsSection({ news }: { news: GamingNewsItem[] }) {
  const [source, setSource] = useState<GamingNewsSource | 'all' | 'lol-patches'>('all');
  const [visibleCount, setVisibleCount] = useState(8);
  const [patchIndex, setPatchIndex] = useState<LolPatchIndex | null>(null);
  const [patchError, setPatchError] = useState('');
  const [retry, setRetry] = useState(0);
  const retryPatches = useCallback(() => setRetry((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden) return;
      try {
        const data = await readJsonResponse<LolPatchIndex>(
          await fetch('/api/lol-patches', { signal: controller.signal }),
        );
        if (!controller.signal.aborted) {
          setPatchIndex(data);
          setPatchError('');
        }
      } catch {
        if (!controller.signal.aborted)
          setPatchError('No se pudieron cargar las notas oficiales de Riot.');
      }
    }
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    void refresh();
    const interval = window.setInterval(() => void refresh(), 900000);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', visible);
      window.clearInterval(interval);
    };
  }, [retry]);
  const visible = news.filter((item) => source === 'all' || source === item.source);
  return (
    <section className="news-section" aria-labelledby="recent-news-title">
      <div className="news-header">
        <div>
          <p className="eyebrow">
            <span className="news-pulse-dot" aria-hidden="true" /> GLOBAL GAMING WIRE // LIVE TICKER
          </p>
          <h2 id="recent-news-title">Noticias Recientes</h2>
          <p className="muted">
            Actualidad de consolas, estudios, lanzamientos y la industria gamer.
          </p>
          <p className="muted news-cache-note">Fuentes RSS · actualización cada 30 minutos.</p>
        </div>
        <span className="news-live-tag">{news.length ? '● EN DIRECTO' : '● SIN SEÑAL'}</span>
      </div>
      <div
        className="filter-buttons news-filters"
        role="group"
        aria-label="Filtrar noticias por fuente"
      >
        {(
          [
            ['all', 'Todas'],
            ['vandal', 'Vandal'],
            ['3djuegos', '3DJuegos'],
            ['ign', 'IGN'],
            ['anime', 'Anime & Manga'],
            ['lol-patches', 'Notas de parche LoL'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`button small ${source === value ? '' : 'outline'}`}
            aria-pressed={source === value}
            onClick={() => {
              setSource(value);
              setVisibleCount(8);
            }}
          >
            {label}
            {value === 'lol-patches' && patchIndex?.latestVersion ? (
              <span className="patch-version">Parche {patchIndex.latestVersion}</span>
            ) : null}
          </button>
        ))}
      </div>
      {source === 'lol-patches' ? (
        <LolPatchNotesHub index={patchIndex} error={patchError} onRetry={retryPatches} />
      ) : (
        <>
          {visible.length ? (
            <ul className="news-table">
              {visible.slice(0, visibleCount).map((item) => (
                <li className="news-row" key={item.url}>
                  <time
                    className="news-time"
                    dateTime={item.publishedAt}
                    title={new Date(item.publishedAt).toLocaleString('es-CL', {
                      timeZone: 'America/Santiago',
                    })}
                  >
                    {item.relativeTime}
                  </time>
                  <span className={`news-source-tag badge-${item.source}`}>
                    [{item.source.toUpperCase()}]
                  </span>
                  <NewsThumbnail key={item.imageUrl} src={item.imageUrl} />
                  <div className="news-copy">
                    <a
                      className="news-title"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.title}
                      <span className="sr-only"> (abre en otra pestaña)</span>
                    </a>
                    {item.description ? <p className="news-desc">{item.description}</p> : null}
                  </div>
                  <span className="news-arrow" aria-hidden="true">
                    ↗
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state" role="status">
              {news.length
                ? 'No hay noticias de esta fuente en la selección reciente.'
                : 'No se pudieron cargar las noticias. Vuelve a intentarlo más tarde.'}
            </p>
          )}
          {visibleCount < visible.length ? (
            <div className="news-load-more-wrap">
              <button
                type="button"
                className="button outline small news-load-more"
                onClick={() => setVisibleCount((previous) => previous + 6)}
              >
                ▾ Cargar más noticias ({Math.min(6, visible.length - visibleCount)} restantes)
              </button>
            </div>
          ) : visible.length > 8 ? (
            <p className="muted news-end-wire" role="status">
              ● Fin de la transmisión del día
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
