'use client';
import { useId, useRef, useState } from 'react';
import {
  PLAYER_TITLES,
  AVATAR_FRAMES,
  levelFromXp,
  xpProgress,
  xpForLevel,
  XP_ACTIONS,
} from '@/domain/progression';

const XP_GUIDE = [
  ['platinum', '👑 100% Platinum', 'Completar todos los logros'],
  ['steam_connected', '🎮 Conectar cuenta de Steam', 'Primera conexión de Steam'],
  ['psn_connected', '🟦 Conectar PlayStation (PSN)', 'Primera conexión de PlayStation'],
  ['xbox_connected', '🟩 Conectar Xbox Live', 'Primera conexión de Xbox'],
  ['cleared', '🏆 Finalizar Campaña (Cleared)', 'Llegar a los créditos finales'],
  ['review', '✍️ Escribir Reseña de Juego', 'Publicar tu reseña'],
  ['highlight', '📸 Publicar Momento (Highlight)', 'Compartir un momento'],
  ['session', '🕹️ Registrar Sesión de Juego', 'Guardar una sesión de juego'],
] as const;

function arcadeRank(level: number) {
  if (level < 5) return 'Rango Arcade Novato';
  if (level < 10) return 'Rango Bronce 8-Bit';
  if (level < 20) return 'Rango Plata 16-Bit';
  if (level < 30) return 'Rango Oro Cyberpunk';
  if (level < 40) return 'Rango Platino Pro Gamer';
  if (level < 50) return 'Rango Leyenda Secret Boss';
  return 'Rango Supremo Final Boss';
}

export function LevelBadge({ level }: { level: number }) {
  return (
    <span className="level-badge" aria-label={`Nivel ${level}`}>
      ✦ LVL {level}
    </span>
  );
}
export function LevelProgress({ xp = 0 }: { xp?: number }) {
  const [tab, setTab] = useState<'road' | 'guide'>('road');
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
          🎁 Próxima recompensa: {next?.name ?? 'Todos los cosméticos desbloqueados'} · Ver camino y
          guía de XP →
        </span>
      </button>
      <dialog ref={dialog} className="rewards-dialog panel" aria-labelledby={heading}>
        <div className="inline-actions">
          <h2 id={heading}>Recompensas y progreso</h2>
          <button
            type="button"
            className="button secondary"
            onClick={() => dialog.current?.close()}
          >
            Cerrar
          </button>
        </div>
        <div
          className="filter-buttons rewards-tabs"
          role="group"
          aria-label="Secciones de progreso"
        >
          <button
            type="button"
            className={`button small ${tab === 'road' ? '' : 'outline'}`}
            aria-pressed={tab === 'road'}
            onClick={() => setTab('road')}
          >
            🏆 Camino de Recompensas
          </button>
          <button
            type="button"
            className={`button small ${tab === 'guide' ? '' : 'outline'}`}
            aria-pressed={tab === 'guide'}
            onClick={() => setTab('guide')}
          >
            ⚡ Cómo Ganar XP
          </button>
        </div>
        {tab === 'road' ? (
          <ol className="rewards-road" aria-label="Camino de Recompensas">
            {Array.from({ length: 50 }, (_, index) => index + 1).map((step) => {
              const names = [
                ...PLAYER_TITLES.filter((item) => item.level === step).map(
                  (item) => `👑 Título: ${item.name}`,
                ),
                ...AVATAR_FRAMES.filter((item) => item.level === step).map(
                  (item) => `🖼️ Marco: ${item.name}`,
                ),
              ];
              return (
                <li
                  key={step}
                  className={
                    step === level
                      ? 'reward-current'
                      : step < level
                        ? 'reward-unlocked'
                        : 'reward-locked'
                  }
                  aria-current={step === level ? 'step' : undefined}
                >
                  <strong>
                    LVL {step} ·{' '}
                    <span className="reward-status">
                      {step === level
                        ? '★ TU NIVEL ACTUAL'
                        : step < level
                          ? '✓ Obtenido'
                          : '🔒 Bloqueado'}
                    </span>
                  </strong>
                  <span>{names.join(' · ') || arcadeRank(step)}</span>
                  <small>
                    {xpForLevel(step).toLocaleString('es')} XP totales
                    {step > level
                      ? ` · Faltan ${(xpForLevel(step) - xp).toLocaleString('es')} XP`
                      : ''}
                  </small>
                </li>
              );
            })}
          </ol>
        ) : (
          <section aria-label="Cómo Ganar XP">
            <div className="xp-guide-grid">
              {XP_GUIDE.map(([action, title, description]) => (
                <article className="xp-guide-card" key={action}>
                  <strong>+{XP_ACTIONS[action]} XP</strong>
                  <h3>{title}</h3>
                  <p className="muted">{description}</p>
                </article>
              ))}
            </div>
            <p className="muted xp-guide-note">
              Los premios por completar juegos y conectar cuentas se otorgan una sola vez por acción
              y referencia.
            </p>
          </section>
        )}
      </dialog>
    </div>
  );
}
