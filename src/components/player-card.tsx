import Image from 'next/image';
import Link from 'next/link';
import { AvatarFrame } from '@/components/avatar-frame';
import { friendLevelTier } from '@/domain/player-friends';
import type { Profile } from '@/domain/model';

type CardProfile = Pick<
  Profile,
  | 'username'
  | 'avatar_url'
  | 'equipped_frame'
  | 'equipped_title'
  | 'level'
  | 'theme_color'
  | 'terminal_status'
  | 'steam_id'
  | 'xbox_gamertag'
  | 'psn_id'
>;

export function PlayerCard({ profile }: { profile: CardProfile }) {
  const href = `/players/${encodeURIComponent(profile.username)}`;
  const level = profile.level ?? 1;
  return (
    <article className={`player-card theme-${profile.theme_color}`}>
      <div className="player-card-heading">
        <AvatarFrame frame={profile.equipped_frame}>
          <div className="avatar">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={`Avatar de ${profile.username}`}
                width={64}
                height={64}
                unoptimized
              />
            ) : (
              <span aria-hidden="true">▣</span>
            )}
          </div>
        </AvatarFrame>
        <div className="player-card-identity">
          <h2>
            <Link href={href}>@{profile.username}</Link>
          </h2>
          <p className="muted">{profile.equipped_title || 'Insert Coin'}</p>
        </div>
        <span
          className={`friend-level-circle friend-level-${friendLevelTier(level)}`}
          aria-label={`Nivel ${level}`}
        >
          {level}
        </span>
      </div>
      <div className="tags" aria-label="Plataformas conectadas">
        {profile.steam_id ? <span className="tag">🖥️ Steam</span> : null}
        {profile.xbox_gamertag ? <span className="tag">🟩 Xbox</span> : null}
        {profile.psn_id ? <span className="tag">🎮 PSN</span> : null}
      </div>
      <p className="profile-terminal player-card-terminal">
        {profile.username}@savestate:~$ {profile.terminal_status || 'Ready to play'}
      </p>
      <Link className="button outline small player-card-link" href={href}>
        Ver perfil ↗
      </Link>
    </article>
  );
}
