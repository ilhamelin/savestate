'use client';
import { useState } from 'react';
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
  const [source, setSource] = useState<GamingNewsSource | 'all'>('all');
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
            ['ign', 'IGN'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`button small ${source === value ? '' : 'outline'}`}
            aria-pressed={source === value}
            onClick={() => setSource(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {visible.length ? (
        <ul className="news-table">
          {visible.map((item) => (
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
                <a className="news-title" href={item.url} target="_blank" rel="noopener noreferrer">
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
    </section>
  );
}
