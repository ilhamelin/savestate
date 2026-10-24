'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Game } from '@/domain/model';
import { gameScreenshotUrls } from '@/domain/game-screenshots';
import '@/styles/game-screenshots.css';

export function GameScreenshotsModal({
  game,
  onClose,
}: {
  game: Game | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [selection, setSelection] = useState({ gameId: game?.id, index: 0 });
  const screenshots = gameScreenshotUrls(game?.screenshots);
  const index =
    selection.gameId === game?.id && selection.index < screenshots.length ? selection.index : 0;
  const currentScreenshot = screenshots[index];
  const hasImages = screenshots.length > 0;
  useEffect(() => {
    const element = dialog.current;
    if (!element || !hasImages) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    closeButton.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [game?.id, hasImages]);
  if (!game || !currentScreenshot) return null;
  function select(next: number) {
    setSelection({ gameId: game!.id, index: (next + screenshots.length) % screenshots.length });
  }
  return (
    <dialog
      ref={dialog}
      className="screenshots-lightbox"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          select(index + (event.key === 'ArrowLeft' ? -1 : 1));
        }
      }}
    >
      <div className="screenshots-lightbox-content">
        <header className="screenshots-lightbox-header">
          <div>
            <p className="eyebrow">IN-GAME CAPTURES // QUICKVIEW</p>
            <h2 id={titleId}>{game.title}</h2>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="button outline small"
            onClick={onClose}
            aria-label="Cerrar galería"
          >
            ✕ Cerrar
          </button>
        </header>
        <div className="screenshots-stage">
          <Image
            key={currentScreenshot}
            src={currentScreenshot}
            alt={`Captura ${index + 1} de ${game.title}`}
            width={1280}
            height={720}
            unoptimized
          />
          <button
            type="button"
            className="screenshots-arrow screenshots-previous"
            disabled={screenshots.length === 1}
            aria-label="Captura anterior"
            onClick={() => select(index - 1)}
          >
            ←
          </button>
          <button
            type="button"
            className="screenshots-arrow screenshots-next"
            disabled={screenshots.length === 1}
            aria-label="Siguiente captura"
            onClick={() => select(index + 1)}
          >
            →
          </button>
        </div>
        <div className="screenshots-lightbox-footer">
          <span role="status" aria-live="polite">
            {index + 1} / {screenshots.length}
          </span>
          <Link href={`/games/${game.slug}`} className="button outline small">
            Ver ficha ↗
          </Link>
        </div>
        <div className="screenshots-thumbnails" role="group" aria-label="Seleccionar captura">
          {screenshots.map((url, position) => (
            <button
              type="button"
              key={url}
              aria-label={`Ver captura ${position + 1}`}
              aria-pressed={position === index}
              onClick={() => select(position)}
            >
              <Image src={url} alt="" width={96} height={54} loading="lazy" unoptimized />
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
