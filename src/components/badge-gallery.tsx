import { LockKeyhole } from 'lucide-react';
import { calculatePlayerLevel, type Badge, type UserBadge } from '@/domain/badges';
import { BadgePixelIcon } from '@/components/badge-pixel-icon';

export function BadgeGallery({ catalogue, earned }: { catalogue: Badge[]; earned: UserBadge[] }) {
  const badges = [...new Map(catalogue.map(badge => [badge.id, badge])).values()];
  const ids = new Set(badges.map(badge => badge.id));
  const unlocked = new Map(earned.filter(badge => ids.has(badge.badge_id)).map(badge => [badge.badge_id, badge.unlocked_at]));
  const player = calculatePlayerLevel(unlocked.size, badges.length);
  return (
    <section id="player-badges" className="badge-showcase" aria-labelledby="badge-heading">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            ACHIEVEMENT UNLOCKED · {player.earnedCount}/{player.totalCount}
          </p>
          <h2 id="badge-heading">Trofeos y Medallas.</h2>
        </div>
      </div>
      <div className="badge-level-panel">
        <p className="eyebrow">RANGO POR MEDALLAS · NIVEL {player.level}</p>
        <h3>{player.title}</h3>
        <p>{player.earnedCount} de {player.totalCount} desbloqueadas — {player.progressPercentage}%</p>
        <progress value={player.progressPercentage} max={100} aria-label="Progreso general de medallas"
          aria-valuetext={`${player.earnedCount} de ${player.totalCount} medallas desbloqueadas`} />
        <small className="muted">
          {player.nextLevelThreshold === null ? 'Rango máximo de medallas alcanzado.' :
            `Siguiente rango: ${player.nextLevelThreshold} medallas.`}
          {' '}Este rango es independiente del nivel de XP del perfil.
        </small>
      </div>
      <div className="badge-grid">
        {badges.map((badge) => {
          const date = unlocked.get(badge.id);
          return (
            <article
              key={badge.id}
              className={`badge-card ${date ? 'badge-earned' : 'badge-locked'}`}
            >
              <BadgePixelIcon icon={badge.icon_pixel} />
              <h3>{badge.name}</h3>
              <p>{badge.description}</p>
              {date ? (
                <time dateTime={date}>
                  Desbloqueada:{' '}
                  {new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeZone: 'UTC' }).format(
                    new Date(date),
                  )}
                </time>
              ) : (
                <span className="badge-lock">
                  <LockKeyhole size={14} aria-hidden="true" /> Bloqueada
                </span>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
