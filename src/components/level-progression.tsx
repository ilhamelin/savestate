'use client';
import { useId, useRef } from 'react';
import {
  PLAYER_TITLES,
  AVATAR_FRAMES,
  levelFromXp,
  xpProgress,
  xpForLevel,
} from '@/domain/progression';

export function LevelBadge({ level }: { level: number }) {
  return (
    <span className="level-badge" aria-label={`Nivel ${level}`}>
      ✦ LVL {level}
    </span>
  );
}
export function LevelProgress({ xp = 0 }: { xp?: number }) {
  const level = levelFromXp(xp),
    progress = xpProgress(xp);
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useId();
  const next = [
    ...PLAYER_TITLES.map((item) => ({ level: item.level, name: item.name })),
    ...AVATAR_FRAMES.filter((item) => item.id !== 'default').map((item) => ({
      level: item.level,
      name: item.name,
    })),
  ]
    .filter((item) => item.level > level)
    .sort((a, b) => a.level - b.level)[0];
  return (
    <div className="level-progress">
      <button
        type="button"
        className="xp-hud"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
      >
        <span>
          ✦ LVL {level} · {xp.toLocaleString('es')} XP totales
        </span>
        <span className="xp-track" aria-hidden="true">
          <span style={{ width: `${progress.percent}%` }} />
        </span>
        <span>
          {progress.current} / {progress.max} XP · {Math.floor(progress.percent)}%
        </span>
        <span className="muted">
          {next
            ? `Próxima recompensa: ${next.name} · nivel ${next.level}`
            : 'Todos los cosméticos desbloqueados'}{' '}
          · Ver camino de recompensas →
        </span>
      </button>
      <dialog ref={dialog} className="rewards-dialog panel" aria-labelledby={heading}>
        <div className="inline-actions">
          <h2 id={heading}>Camino de Recompensas</h2>
          <button
            type="button"
            className="button secondary"
            onClick={() => dialog.current?.close()}
          >
            Cerrar
          </button>
        </div>
        <ol className="rewards-road">
          {Array.from({ length: 50 }, (_, index) => index + 1).map((step) => {
            const names = [
              ...PLAYER_TITLES.filter((item) => item.level === step).map((item) => item.name),
              ...AVATAR_FRAMES.filter((item) => item.level === step).map((item) => item.name),
            ];
            return (
              <li
                key={step}
                className={step <= level ? 'reward-unlocked' : 'reward-locked'}
                aria-current={step === level ? 'step' : undefined}
              >
                <strong>
                  LVL {step} · {step <= level ? '✓ Desbloqueado' : '🔒 Bloqueado'}
                </strong>
                <span>{names.join(' · ') || 'Continúa tu aventura'}</span>
                <small>{xpForLevel(step).toLocaleString('es')} XP</small>
              </li>
            );
          })}
        </ol>
      </dialog>
    </div>
  );
}
