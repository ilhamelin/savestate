'use client';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  matchesPlatformFilter,
  formatFreebieTimeRemaining,
  type FreebieItem,
  type FreebiePlatformCategory,
} from '@/domain/freebies';

const CATEGORIES: { key: FreebiePlatformCategory; label: string; icon: string }[] = [
  { key: 'all', label: 'Todos', icon: '🎮' },
  { key: 'steam', label: 'Steam', icon: '🔵' },
  { key: 'epic', label: 'Epic Games', icon: '🟣' },
  { key: 'gog', label: 'GOG', icon: '🟠' },
  { key: 'consoles', label: 'Consolas', icon: '🕹️' },
  { key: 'pc', label: 'PC / DRM', icon: '💻' },
];

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
  const [filter, setFilter] = useState<FreebiePlatformCategory>('all');
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const sync = () => setNow(Date.now());
    const initial = setTimeout(sync, 0);
    const timer = setInterval(sync, 30000);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
  const counts = useMemo(() => {
    const result: Record<FreebiePlatformCategory, number> = {
      all: freebies.length,
      steam: 0,
      epic: 0,
      gog: 0,
      consoles: 0,
      pc: 0,
    };
    for (const item of freebies)
      for (const { key } of CATEGORIES)
        if (key !== 'all' && matchesPlatformFilter(item.platforms, key)) result[key]++;
    return result;
  }, [freebies]);
  const activeFilter = counts[filter] ? filter : 'all';
  const visibleItems = useMemo(
    () => freebies.filter((item) => matchesPlatformFilter(item.platforms, activeFilter)),
    [freebies, activeFilter],
  );
  return (
    <section className="freebies-section" aria-labelledby="freebies-title">
      <p className="eyebrow freebies-halloween-eyebrow">
        <Image
          src="/icons/halloween/comida-de-halloween.png"
          alt=""
          width={16}
          height={16}
          unoptimized
        />
        <span>TRUCO O TRATO // JUEGOS GRATIS ACTIVOS</span>
      </p>
      <h2 id="freebies-title">Radar de Juegos Gratis</h2>
      <p className="muted">
        Títulos para reclamar y quedarte para siempre en Steam, Epic Games y GOG.
      </p>
      <div className="freebies-filters" role="group" aria-label="Filtrar por plataforma">
        {CATEGORIES.map(({ key, label, icon }) =>
          key !== 'all' && counts[key] === 0 ? null : (
            <button
              key={key}
              type="button"
              aria-pressed={activeFilter === key}
              className={`button small${activeFilter === key ? '' : ' outline'}`}
              onClick={() => setFilter(key)}
            >
              <span>
                {icon} {label}
              </span>
              <span className="freebies-count-tag">{counts[key]}</span>
            </button>
          ),
        )}
      </div>
      {visibleItems.length ? (
        <div className="freebies-grid">
          {visibleItems.map((item) => {
            const countdown = now === null ? null : formatFreebieTimeRemaining(item.endDate, now);
            return (
              <article className="freebie-card" key={item.id}>
                <div className="freebie-art">
                  <FreebieImage key={item.thumbnail} src={item.thumbnail} />
                  {countdown && (
                    <span
                      className={`freebie-countdown-badge${countdown.isUrgent ? ' urgent' : ''}`}
                      title={`Finaliza: ${item.endDate} (UTC)`}
                    >
                      {countdown.isUrgent ? '🔥 ' : '⏳ '}
                      {countdown.label}
                    </span>
                  )}
                  <span className="freebie-platform">[{item.platforms}]</span>
                </div>
                <div className="freebie-copy">
                  <span className="freebie-worth-tag">🎃 100% OFF · Valor {item.worth}</span>
                  <h3>{item.title}</h3>
                  <a
                    className="button outline small"
                    href={item.openGiveawayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    🍬 Reclamar dulce ↗<span className="sr-only"> (abre en otra pestaña)</span>
                  </a>
                </div>
              </article>
            );
          })}
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
