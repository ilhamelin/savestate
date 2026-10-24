'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Gamepad2, ArrowUpRight } from 'lucide-react';
import type { Game } from '@/domain/model';
import { gameScreenshotUrls } from '@/domain/game-screenshots';
import '@/styles/game-screenshots.css';

export function GameCard({
  game,
  score,
  prefetch,
  daysUntil,
  onOpenGallery,
}: {
  game: Game;
  score?: number | null;
  prefetch?: boolean;
  daysUntil?: number | null;
  onOpenGallery?: (game: Game) => void;
}) {
  const screenshots = gameScreenshotUrls(game.screenshots);
  const [peeking, setPeeking] = useState(false);
  const [index, setIndex] = useState(0);
  const [loadedUrl, setLoadedUrl] = useState('');
  const screenshot = screenshots[index] ?? screenshots[0];
  function peek(nextIndex = 0) {
    if (!screenshots.length) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    setIndex(nextIndex);
    setPeeking(true);
  }
  return (
    <div
      className={`game-card${peeking && loadedUrl === screenshot ? ' is-peeking' : ''}`}
      onMouseEnter={() => peek()}
      onMouseLeave={() => setPeeking(false)}
    >
      <Link href={`/games/${game.slug}`} className="game-card-link" prefetch={prefetch}>
        <div className="cover">
          {game.cover_url ? (
            <Image
              src={game.cover_url}
              alt={`Portada de ${game.title}`}
              fill
              sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 240px"
            />
          ) : (
            <Gamepad2 size={48} aria-hidden="true" />
          )}
        </div>
        {screenshots.length > 0 && (
          <div className="game-card-peek" aria-hidden="true">
            {peeking && screenshot && (
              <Image
                key={screenshot}
                src={screenshot}
                alt=""
                fill
                unoptimized
                sizes="(max-width: 600px) 50vw, 240px"
                onLoad={() => setLoadedUrl(screenshot)}
                onError={() => setLoadedUrl('')}
              />
            )}
          </div>
        )}
        <div className="game-card-badges">
          <span className="game-poster-badge">{game.release_year ?? 'TBA'}</span>
          {score ? <span className="game-poster-badge score">★ {score}</span> : null}
          {daysUntil != null && daysUntil > 0 ? (
            <span className="game-poster-badge countdown">
              ⏳ {daysUntil === 1 ? 'Mañana' : `Faltan ${daysUntil}d`}
            </span>
          ) : null}
        </div>
        <div className="game-card-body">
          <h3 className="line-clamp-2" title={game.title}>
            {game.title}
          </h3>
          <p className="line-clamp-2">
            {game.platforms.slice(0, 2).join(' / ') || 'Plataforma por confirmar'}
          </p>
          <span className="card-link">
            Ver ficha <ArrowUpRight size={14} />
          </span>
        </div>
      </Link>
      {screenshots.length > 0 && (
        <>
          {onOpenGallery && (
            <button
              type="button"
              className="game-gallery-trigger"
              aria-label={`Ver ${screenshots.length} capturas de ${game.title}`}
              aria-haspopup="dialog"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenGallery({ ...game, screenshots });
              }}
            >
              📸 {screenshots.length} fotos
            </button>
          )}
          {screenshots.length > 1 && (
            <div
              className="game-peek-indicators"
              role="group"
              aria-label={`Vista previa de ${game.title}`}
            >
              {screenshots.map((url, position) => (
                <button
                  key={url}
                  type="button"
                  aria-label={`Vista previa ${position + 1} de ${game.title}`}
                  aria-pressed={peeking && index === position}
                  onMouseEnter={() => peek(position)}
                  onFocus={() => peek(position)}
                  onClick={() => peek(position)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
