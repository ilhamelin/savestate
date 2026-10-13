'use client';
import Image from 'next/image';
import { Film, Tv, Star, Plus } from 'lucide-react';
import { screenAdaptation } from '@/domain/game-adaptations';
import { screenPercent, type ScreenMediaItem, type ScreenUserProgress } from '@/domain/screen';
export function ScreenCard({
  item,
  progress,
  selected,
  onSelect,
  onAdvance,
  disabled,
}: {
  item: ScreenMediaItem;
  progress?: ScreenUserProgress;
  selected: boolean;
  onSelect: () => void;
  onAdvance: () => void;
  disabled: boolean;
}) {
  const link = screenAdaptation(item.tmdbId, item.mediaType);
  return (
    <article className={`screen-card screen-hud-card ${selected ? 'screen-hud-glow' : ''}`}>
      <button
        type="button"
        className="screen-poster"
        onClick={onSelect}
        aria-label={`Ver ${item.title}`}
      >
        {item.posterUrl ? (
          <Image src={item.posterUrl} alt="" fill unoptimized loading="lazy" />
        ) : (
          <span className="screen-poster-empty">
            {item.mediaType === 'tv' ? <Tv size={38} /> : <Film size={38} />}
            <span>{item.title}</span>
          </span>
        )}
        <span className="screen-card-top">
          <span>{item.releaseYear ?? (item.source === 'demo' ? 'DEMO' : 'S/F')}</span>
          {item.rating !== null && (
            <span>
              <Star size={12} />
              {item.rating.toFixed(1)}
            </span>
          )}
        </span>
        <span className="screen-card-bottom">
          <span>{item.mediaType === 'tv' ? 'SERIE' : 'PELÍCULA'}</span>
          <strong>{item.title}</strong>
        </span>
      </button>
      <div className="screen-card-meta">
        {item.providers
          .filter((provider) => provider.offer === 'subscription')
          .slice(0, 2)
          .map((provider) => (
            <span className="screen-badge-streaming" key={provider.id}>
              {provider.name}
            </span>
          ))}
        {link && <span className="screen-adaptation-chip">{link.developerOrPublisher}</span>}
        <progress
          max={100}
          value={screenPercent(progress)}
          aria-label={`Progreso de ${item.title}`}
        />
        <div className="screen-card-actions">
          <span className="muted">
            {progress ? `${screenPercent(progress)}%` : 'Sin registrar'}
          </span>
          {item.mediaType === 'tv' && (
            <button
              type="button"
              className="button outline small"
              disabled={disabled}
              onClick={onAdvance}
              aria-label={`Marcar siguiente episodio de ${item.title}`}
            >
              <Plus size={12} />1 Ep
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
