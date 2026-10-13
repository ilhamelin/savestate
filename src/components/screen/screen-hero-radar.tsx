'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Film, Gamepad2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { screenAdaptation } from '@/domain/game-adaptations';
import { screenPercent, type ScreenMediaItem, type ScreenUserProgress } from '@/domain/screen';
export function ScreenHeroRadar({
  items,
  progress,
  onSelect,
}: {
  items: ScreenMediaItem[];
  progress: Record<string, ScreenUserProgress>;
  onSelect: (item: ScreenMediaItem) => void;
}) {
  const [slot, setSlot] = useState(0);
  const item = items[slot];
  if (!item) return null;
  const adaptation = screenAdaptation(item.tmdbId, item.mediaType),
    entry = progress[item.id];
  return (
    <section className="screen-hero screen-hud-card" aria-label="Radar de adaptaciones gamer">
      {item.backdropUrl && (
        <Image
          className="screen-hero-backdrop"
          src={item.backdropUrl}
          alt=""
          fill
          unoptimized
          priority
        />
      )}
      <div className="screen-hero-content">
        <p className="eyebrow">
          <Film size={14} /> GAME TO SCREEN // RADAR {String(slot + 1).padStart(2, '0')} /{' '}
          {String(items.length).padStart(2, '0')}
        </p>
        <h1>{item.title}</h1>
        <p className="screen-hero-overview">{item.overview}</p>
        <p className="muted">
          {adaptation?.developerOrPublisher} {item.source === 'demo' ? '· MODO DEMO' : ''}
        </p>
        <div className="screen-hero-telemetry">
          <span>
            {entry
              ? `${entry.watchedEpisodes.length} / ${entry.totalEpisodes} episodios · ${screenPercent(entry)}%`
              : 'SIN CHECKPOINT // Empieza tu bitácora'}
          </span>
          <progress
            max={100}
            value={screenPercent(entry)}
            aria-label="Progreso de la adaptación destacada"
          />
        </div>
        <div className="filter-buttons">
          <button className="button" type="button" onClick={() => onSelect(item)}>
            <Plus size={14} /> Registrar progreso
          </button>
          {adaptation && (
            <Link className="button outline" href={`/games/${adaptation.gameSlug}`}>
              <Gamepad2 size={14} /> {adaptation.gameTitle}
            </Link>
          )}
        </div>
      </div>
      <div className="screen-radar-slots">
        <button
          type="button"
          className="button outline small"
          aria-label="Adaptación anterior"
          onClick={() => setSlot((slot + items.length - 1) % items.length)}
        >
          <ChevronLeft size={16} />
        </button>
        {items.map((entry, index) => (
          <button
            type="button"
            key={entry.id}
            className={`button ${index === slot ? '' : 'outline'} small`}
            aria-pressed={index === slot}
            aria-label={`Mostrar ${entry.title}`}
            onClick={() => setSlot(index)}
          >
            {String(index + 1).padStart(2, '0')}
          </button>
        ))}
        <button
          type="button"
          className="button outline small"
          aria-label="Siguiente adaptación"
          onClick={() => setSlot((slot + 1) % items.length)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}
