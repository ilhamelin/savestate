import Image from 'next/image';
import type { ReactNode } from 'react';
import type { Profile } from '@/domain/model';
import { DecryptedText } from '@/components/ui/decrypted-text';

type Identity = Pick<Profile, 'username' | 'avatar_url' | 'banner_url' | 'terminal_status'>;

export function ProfileIdentity({
  profile,
  headingLevel = 1,
  children,
  animateTerminal = false,
  avatarOverlay,
  bannerOverlay,
  usernameEditor,
  terminalEditor,
}: {
  profile: Identity;
  headingLevel?: 1 | 2;
  children?: ReactNode;
  animateTerminal?: boolean;
  avatarOverlay?: ReactNode;
  bannerOverlay?: ReactNode;
  usernameEditor?: ReactNode;
  terminalEditor?: ReactNode;
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
        <div>
          <p className="eyebrow">PLAYER PROFILE</p>
          <Heading>{usernameEditor ?? <>@{profile.username}</>}</Heading>
          <p className="profile-terminal">
            {terminalEditor ?? (animateTerminal ? <DecryptedText text={terminal} /> : terminal)}
          </p>
          {children}
        </div>
      </div>
    </>
  );
}
