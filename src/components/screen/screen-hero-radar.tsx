'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Award,
  Gamepad2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Play,
  Settings2,
  Star,
} from 'lucide-react';
import { ScreenTrailerModal } from './screen-trailer-modal';
import { screenAdaptation } from '@/domain/game-adaptations';
import {
  screenPercent,
  type ScreenMediaItem,
  type ScreenRegion,
  type ScreenUserProgress,
} from '@/domain/screen';

const calibration: Record<ScreenRegion, string> = {
  CL: 'LATAM-SUR',
  MX: 'LATAM-NORTE',
  ES: 'ESPAÑA',
  US: 'NORTEAMÉRICA',
};
export function ScreenHeroRadar({
  items,
  progress,
  onSelect,
  region = 'CL',
}: {
  items: ScreenMediaItem[];
  progress: Record<string, ScreenUserProgress>;
  onSelect: (item: ScreenMediaItem) => void;
  region?: ScreenRegion;
}) {
  const [selectedSlot, setSlot] = useState(0);
  const [trailer, setTrailer] = useState<{ id: string; title: string } | null>(null);
  const slot = selectedSlot % Math.max(1, items.length);
  const item = items[slot];
  if (!item) return null;
  const adaptation = screenAdaptation(item.tmdbId, item.mediaType),
    entry = progress[item.id];
  const percent = screenPercent(entry);
  const demo = item.source === 'demo';
  const providers = [...new Set(item.providers.map((provider) => provider.name))];
  const streams = providers.length ? providers : demo ? (adaptation?.streamingBadges ?? []) : [];
  const rating = item.rating ?? (demo ? 9 : null);
  const title = adaptation?.title ?? item.title;
  const slotLabel = `${String(slot + 1).padStart(2, '0')}/${String(items.length).padStart(2, '0')}`;
  function move(delta: number) {
    setSlot((slot + items.length + delta) % items.length);
  }
  return (
    <section
      className="screen-hero screen-hud-card"
      aria-label="Radar de adaptaciones gamer"
      aria-roledescription="carrusel"
    >
      {item.backdropUrl && (
        <Image
          key={item.backdropUrl}
          className="screen-hero-backdrop"
          src={item.backdropUrl}
          alt=""
          fill
          sizes="100vw"
          unoptimized
          loading="eager"
          fetchPriority="high"
        />
      )}
      <div className="screen-hero-top-row">
        <p className="screen-hero-signal">
          <span className="screen-signal-dot" aria-hidden="true" /> RADAR // TRANSMISIÓN DESTACADA{' '}
          <span className="screen-slot-label">| SLOT {slotLabel}</span>
        </p>
        <div className="screen-hero-carousel" role="group" aria-label="Navegar destacados">
          <span>CAROUSEL</span>
          <button
            type="button"
            className="screen-carousel-arrow"
            aria-label="Adaptación anterior"
            disabled={items.length < 2}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="screen-carousel-pill">
            {items.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                className={index === slot ? 'active' : ''}
                aria-label={`Mostrar ${entry.title}`}
                aria-pressed={index === slot}
                onClick={() => setSlot(index)}
              >
                <span />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="screen-carousel-arrow"
            aria-label="Siguiente adaptación"
            disabled={items.length < 2}
            onClick={() => move(1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="screen-hero-content">
        <div className="screen-hero-badges">
          {adaptation?.rankBadge && (
            <span className="screen-hero-rank" title="Selección editorial del radar">
              <Award size={14} /> {adaptation.rankBadge}
            </span>
          )}
          {adaptation?.statusBadge && (
            <span className="screen-hero-status">
              <span className="screen-status-dot" aria-hidden="true" /> {adaptation.statusBadge}
            </span>
          )}
          {demo && <span className="screen-hero-demo">DEMO · DATOS DE MUESTRA</span>}
        </div>
        <div className="screen-hero-title-block" aria-live="polite" aria-atomic="true">
          <h1>{title}</h1>
          {adaptation?.subtitle && <p className="screen-hero-subtitle">{adaptation.subtitle}</p>}
        </div>
        <div className="screen-hero-metadata">
          <span className="screen-hero-rating">
            <Star size={16} aria-hidden="true" />{' '}
            {rating === null ? 'Sin puntuación' : `${rating.toFixed(1)}/10`}{' '}
            <span className="screen-hero-votes">
              ({item.voteCount.toLocaleString('es-CL')} votos{demo ? ' · muestra' : ''})
            </span>
          </span>
          <span className="screen-metadata-separator" aria-hidden="true">
            |
          </span>
          <span>{item.releaseYear ?? (demo ? 2024 : 'Año por confirmar')}</span>
          {adaptation?.certification && (
            <>
              <span className="screen-metadata-separator" aria-hidden="true">
                |
              </span>
              <span
                className="screen-metadata-cert"
                aria-label={`Clasificación ${adaptation.certification}`}
              >
                {adaptation.certification}
              </span>
            </>
          )}
          {adaptation && (
            <>
              <span className="screen-metadata-separator" aria-hidden="true">
                |
              </span>
              <span>{adaptation.developerOrPublisher}</span>
            </>
          )}
        </div>
        <div
          className="screen-hero-stream-chips"
          aria-label={`Plataformas de streaming · ${region}${demo ? ' · ejemplo' : ''}`}
        >
          {streams.map((name) => (
            <span
              key={name}
              className={`screen-stream-badge ${/netflix/i.test(name) ? 'netflix' : /max/i.test(name) ? 'max' : /prime/i.test(name) ? 'prime' : ''}`}
            >
              {name.toUpperCase()}
            </span>
          ))}
          {!streams.length && (
            <span className="muted">Disponibilidad por confirmar en {region}</span>
          )}
        </div>
        <div className="screen-hero-telemetry-block">
          <div className="screen-hero-telemetry-labels">
            <span>
              <Play size={12} /> TU PROGRESO DE TRANSMISIÓN
            </span>
            <span>
              {!entry
                ? 'SIN CHECKPOINT // 0% completado'
                : item.mediaType === 'movie'
                  ? `Película · ${percent}% completado`
                  : `Episodio ${entry.watchedEpisodes.length} / ${entry.totalEpisodes} (${percent}% completado)`}
            </span>
          </div>
          <progress max={100} value={percent} aria-label="Progreso de la adaptación destacada" />
        </div>
        <div className="screen-hero-actions">
          <button
            className="button screen-hero-primary-btn"
            type="button"
            onClick={() => onSelect(item)}
          >
            <Plus size={16} /> [+ REGISTRAR PROGRESO]
          </button>
          {item.trailerVideoId && (
            <button
              type="button"
              className="button outline"
              onClick={() => setTrailer({ id: item.trailerVideoId!, title: item.title })}
            >
              <Play size={14} /> Ver Tráiler
            </button>
          )}
          {adaptation && (
            <Link
              className="button outline screen-hero-game-btn"
              href={`/games/${adaptation.gameSlug}`}
            >
              <Gamepad2 size={15} /> [Ficha de Juego: {adaptation.gameTitle}] →
            </Link>
          )}
        </div>
      </div>
      <div className="screen-hero-footer-row">
        <div className="screen-radar-queue" role="group" aria-label="Cola de radar">
          <span>COLA DE RADAR:</span>
          {items.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              className={`screen-radar-queue-btn${index === slot ? ' active' : ''}`}
              aria-pressed={index === slot}
              onClick={() => setSlot(index)}
            >
              {screenAdaptation(entry.tmdbId, entry.mediaType)?.shortTitle ??
                `${String(index + 1).padStart(2, '0')} ${entry.title}`}
              {index === slot && <span className="screen-signal-dot" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <span className="screen-hero-calibration">
          <Settings2 size={12} /> CALIBRACIÓN: {calibration[region]} // JUSTWATCH API
        </span>
      </div>
      {trailer && (
        <ScreenTrailerModal
          videoId={trailer.id}
          title={trailer.title}
          onClose={() => setTrailer(null)}
        />
      )}
    </section>
  );
}
