import Image from 'next/image';
import Link from 'next/link';
import { AvatarFrame } from '@/components/avatar-frame';
import type { Activity, Game, Profile } from '@/domain/model';
import { notificationAge } from '@/domain/notifications';
import { friendLevelTier } from '@/domain/player-friends';

const descriptions: Record<string, string> = {
  platinum: '🏆 ¡Platinó al 100%! en',
  cleared: '🟢 Terminó la campaña de',
  playing: '🎮 Empezó a jugar',
  backlog: '📦 Añadió a su backlog',
  wishlist: '✨ Añadió a su lista de deseos',
  dropped: '⏸️ Dejó de jugar',
};
export function FeedActivityCard({
  event,
  player,
  game,
}: {
  event: Activity;
  player?: Profile;
  game?: Game;
}) {
  const moment = event.event_type === 'moment_shared';
  const status = typeof event.event_data.status === 'string' ? event.event_data.status : '';
  const platinum = !moment && status === 'platinum';
  const description = Object.hasOwn(descriptions, status)
    ? descriptions[status]
    : 'Guardó un checkpoint en';
  const rating = event.event_data.rating;
  const rated =
    typeof rating === 'number' && Number.isFinite(rating) && rating >= 1 && rating <= 10;
  const level = player?.level ?? 1;
  const profileHref = player ? `/players/${encodeURIComponent(player.username)}` : null;
  const gameHref = game ? `/games/${encodeURIComponent(game.slug)}` : null;
  return (
    <article className={`feed-card${platinum ? ' platinum-event' : ''}`}>
      <div className="feed-card-left">
        <AvatarFrame frame={player?.equipped_frame}>
          <div className="feed-card-avatar">
            {player?.avatar_url ? (
              <Image
                src={player.avatar_url}
                width={40}
                height={40}
                alt={`Avatar de ${player.username}`}
                unoptimized
              />
            ) : (
              <span aria-hidden="true">▣</span>
            )}
          </div>
        </AvatarFrame>
        <div className="feed-card-info">
          <div className="feed-card-meta">
            {player && profileHref ? (
              <Link className="accent" href={profileHref}>
                @{player.username}
              </Link>
            ) : (
              <span>Jugador no disponible</span>
            )}
            {player ? (
              <span
                className={`friend-level-circle friend-level-${friendLevelTier(level)}`}
                aria-label={`Nivel ${level}`}
              >
                {level}
              </span>
            ) : null}
          </div>
          <time className="muted" dateTime={event.created_at}>
            {notificationAge(event.created_at, new Date().toISOString())}
          </time>
        </div>
      </div>
      <div className="feed-card-body">
        <p className={platinum ? 'feed-platinum-label' : undefined}>
          {moment ? '📸 Compartió un Momento Gamer en' : description}{' '}
          {game && gameHref ? (
            <Link href={gameHref}>{game.title}</Link>
          ) : (
            <span>un juego no disponible</span>
          )}
        </p>
        {moment && typeof event.event_data.post_id === 'string' ? (
          <Link
            className="accent feed-moment-link"
            href={`/highlights?post=${encodeURIComponent(event.event_data.post_id)}`}
          >
            {typeof event.event_data.title === 'string' ? event.event_data.title : 'Ver momento ↗'}
          </Link>
        ) : null}
        {rated ? (
          <span className="feed-rating">
            ★ {rating}/10{rating >= 9 ? ' · Obra maestra' : ''}
          </span>
        ) : null}
      </div>
      {game && gameHref ? (
        <Link className="feed-card-cover" href={gameHref} aria-label={`Ver ficha de ${game.title}`}>
          {game.cover_url ? (
            <Image
              src={game.cover_url}
              width={48}
              height={64}
              alt={`Carátula de ${game.title}`}
              unoptimized
            />
          ) : (
            <span aria-hidden="true">▣</span>
          )}
        </Link>
      ) : (
        <span className="feed-card-cover" aria-hidden="true">
          ▣
        </span>
      )}
    </article>
  );
}
