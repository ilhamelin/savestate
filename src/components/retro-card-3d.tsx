'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent } from 'react';
import {
  CARD_SHELLS,
  cardTiltForPoint,
  type CardShellSkin,
  type InteractiveCardProps,
} from '@/domain/memory-card';

const motionQuery = '(prefers-reduced-motion: reduce)';
function subscribeMotion(callback: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}
const readMotion = () => window.matchMedia(motionQuery).matches;
const serverMotion = () => true;

export function RetroCard3D({
  username,
  avatarUrl,
  clearRate,
  hours,
  topGames,
  terminalStatus,
  defaultSkin = 'ps1_memory_card',
  qrCode,
  children,
}: InteractiveCardProps) {
  const [skin, setSkin] = useState<CardShellSkin>(defaultSkin);
  const [flipped, setFlipped] = useState(false);
  const reduced = useSyncExternalStore(subscribeMotion, readMotion, serverMotion);
  const id = useId();
  const scene = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);

  function resetTilt() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const style = tilt.current?.style;
    style?.setProperty('--card-rx', '0deg');
    style?.setProperty('--card-ry', '0deg');
    style?.setProperty('--card-glare', '0');
  }
  useEffect(() => {
    if (reduced) resetTilt();
    return resetTilt;
  }, [reduced]);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (reduced || !scene.current || !tilt.current) return;
    const state = cardTiltForPoint(
      event.clientX,
      event.clientY,
      scene.current.getBoundingClientRect(),
      flipped,
    );
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      // A preference change must also invalidate an already queued pointer frame.
      if (readMotion()) return resetTilt();
      const style = tilt.current?.style;
      style?.setProperty('--card-rx', state.rotateX + 'deg');
      style?.setProperty('--card-ry', state.rotateY + 'deg');
      style?.setProperty('--card-gx', state.glareX + '%');
      style?.setProperty('--card-gy', state.glareY + '%');
      style?.setProperty('--card-glare', '1');
    });
  }
  const favorites = topGames.slice(0, 4);
  return (
    <div className="retro-card" data-skin={skin}>
      <div className="retro-card-controls">
        <label htmlFor={id + '-skin'}>
          Chasis retro
          <select
            id={id + '-skin'}
            value={skin}
            onChange={(event) => {
              resetTilt();
              setSkin(event.target.value as CardShellSkin);
            }}
          >
            {(Object.keys(CARD_SHELLS) as CardShellSkin[]).map((key) => (
              <option key={key} value={key}>
                {CARD_SHELLS[key].label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button outline small"
          aria-controls={id + '-object'}
          aria-pressed={flipped}
          onClick={() => {
            resetTilt();
            setFlipped((value) => !value);
          }}
        >
          🔄 {flipped ? 'Ver cara frontal' : 'Girar Tarjeta'}
        </button>
      </div>
      <div
        ref={scene}
        className="retro-card-scene"
        onPointerDown={move}
        onPointerMove={move}
        onPointerLeave={resetTilt}
        onPointerCancel={resetTilt}
        onPointerUp={resetTilt}
      >
        <div ref={tilt} className="retro-card-tilt">
          <div id={id + '-object'} className="retro-card-object" data-flipped={flipped}>
            <div className="retro-card-front" aria-hidden={flipped} inert={flipped}>
              <div className="retro-card-molding" aria-hidden="true">
                <i /> SAVESTATE // {skin === 'ps1_memory_card' ? '15 BLOCKS' : 'GAME PAK'}
              </div>
              <div className="retro-card-sticker">
                <div className="retro-card-identity">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="" width={44} height={44} unoptimized />
                  ) : (
                    <span aria-hidden="true">▣</span>
                  )}
                  <strong>@{username}</strong>
                </div>
                <p className="retro-card-status">{terminalStatus || 'Ready to play'}</p>
                <div className="retro-card-stats">
                  <span>
                    <b>{clearRate.toFixed(1)}%</b> completado
                  </span>
                  <span>
                    <b>{hours.toFixed(1)} h</b> registradas
                  </span>
                </div>
                <p className="retro-card-caption">
                  {skin === 'ps1_memory_card'
                    ? 'TOP 4 // FAVORITE CHECKPOINTS'
                    : 'PLAYER’S CHOICE // TOP 1 & FAVORITOS'}
                </p>
                <div className="retro-card-games">
                  {Array.from({ length: 4 }, (_, index) => {
                    const game = favorites[index];
                    return (
                      <div key={index} title={game?.title ?? 'Bloque libre'}>
                        {game?.coverUrl ? (
                          <Image
                            src={game.coverUrl}
                            alt={game.title}
                            width={72}
                            height={96}
                            unoptimized
                          />
                        ) : (
                          <span>{game?.title ?? '▣'}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="retro-card-favorite">
                  {favorites[0]?.title ?? 'Tu próximo checkpoint te espera'}
                </p>
              </div>
              <div className="retro-card-blocks" aria-label="15 bloques de guardado">
                {Array.from({ length: 15 }, (_, i) => (
                  <i key={i} data-used={i < favorites.length} />
                ))}
              </div>
              <div className="retro-card-glare" aria-hidden="true" />
            </div>
            <div className="retro-card-back" aria-hidden={!flipped} inert={!flipped}>
              <span className="retro-card-screw" aria-hidden="true">
                ✦
              </span>
              <strong>SAVESTATE // PLAYER SAVE</strong>
              {qrCode ? (
                <a
                  className="retro-card-qr"
                  href={qrCode.url}
                  aria-label={'Abrir perfil de @' + username}
                >
                  <svg
                    viewBox={'0 0 ' + qrCode.size + ' ' + qrCode.size}
                    role="img"
                    aria-label={'Código QR del perfil de @' + username}
                    shapeRendering="crispEdges"
                  >
                    <rect width={qrCode.size} height={qrCode.size} fill="#fff" />
                    <path d={qrCode.path} fill="none" stroke="#000" strokeWidth="1" />
                  </svg>
                </a>
              ) : (
                <a href={'/players/' + encodeURIComponent(username)}>Abrir perfil de @{username}</a>
              )}
              <span className="retro-card-serial">SS-MODEL-1996 · MADE BY SAVESTATE</span>
              <div className="retro-card-glare" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
      <p className="muted retro-card-hint">
        Mueve el cursor o toca para inclinar. Gira la tarjeta para ver tu QR.
      </p>
      {children?.(skin)}
    </div>
  );
}
