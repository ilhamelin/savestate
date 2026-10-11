import Image from 'next/image';
import type { ReactNode } from 'react';
import type { Profile } from '@/domain/model';
import { DecryptedText } from '@/components/ui/decrypted-text';
import { AvatarFrame } from '@/components/avatar-frame';
import { LevelBadge, LevelProgress } from '@/components/level-progression';

type Identity = Pick<Profile, 'username' | 'avatar_url' | 'banner_url' | 'terminal_status'> &
  Partial<Pick<Profile, 'xp' | 'level' | 'equipped_title' | 'equipped_frame'>>;

export function ProfileIdentity({
  profile,
  headingLevel = 1,
  children,
  animateTerminal = false,
  avatarOverlay,
  bannerOverlay,
  usernameEditor,
  terminalEditor,
  presenceBadge,
}: {
  profile: Identity;
  headingLevel?: 1 | 2;
  children?: ReactNode;
  animateTerminal?: boolean;
  avatarOverlay?: ReactNode;
  bannerOverlay?: ReactNode;
  usernameEditor?: ReactNode;
  terminalEditor?: ReactNode;
  presenceBadge?: ReactNode;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const terminal = `${profile.username}@savestate:~$ ${profile.terminal_status || 'Ready to play'}`;
  return (
    <>
      <div className="profile-banner">
        {profile.banner_url ? (
          <Image
            src={profile.banner_url}
            alt={`Banner de ${profile.username}`}
            fill
            sizes="(max-width: 800px) 100vw, 1200px"
            unoptimized
          />
        ) : null}
        {bannerOverlay}
      </div>
      <div className="profile-heading">
        <div className="profile-identity-main">
          <AvatarFrame frame={profile.equipped_frame}>
            <div className="avatar">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={`Avatar de ${profile.username}`}
                  fill
                  sizes="80px"
                  unoptimized
                />
              ) : (
                <span aria-hidden="true">▣</span>
              )}
              {avatarOverlay}
            </div>
          </AvatarFrame>
          <div className="profile-identity-info">
            <p className="eyebrow">PLAYER PROFILE</p>
            <Heading>{usernameEditor ?? <>@{profile.username}</>}</Heading>
            {presenceBadge}
            <p className="player-rank">
              <LevelBadge level={profile.level ?? 1} />{' '}
              <span>{profile.equipped_title ?? 'Insert Coin'}</span>
            </p>
            <p className="profile-terminal">
              {terminalEditor ?? (animateTerminal ? <DecryptedText text={terminal} /> : terminal)}
            </p>
            {children}
          </div>
        </div>
        <div className="profile-identity-aside">
          <LevelProgress xp={profile.xp ?? 0} />
        </div>
      </div>
    </>
  );
}
