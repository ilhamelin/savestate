import { createMemoryCardQr } from '@/lib/memory-card-qr';
import { resolvePlatformIcon } from '@/domain/platform-icons';
import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { resolveThemeColor } from '@/domain/profile-studio';
import { notFound } from 'next/navigation';
import {
  profileByName,
  libraryFor,
  playerFriends,
  pendingFriendRequests,
} from '@/repositories/player';
import { PlayerFriendsWidget } from '@/components/player-friends-widget';
import { serverClient } from '@/integrations/supabase/server';
import { currentUser } from '@/lib/session';
import { isConfigured, publicEnv, appUrl } from '@/lib/env';
import { wallpaperForDisplay } from '@/domain/wallpaper';
import { dbCheck } from '@/lib/http';
import { Library } from '@/components/library';
import { Top4SlotSelector } from '@/components/top4-slot-selector';
import { ProfileWallpaper } from '@/components/profile-wallpaper';
import { SocialControls } from '@/components/social-controls';
import { SetupNotice } from '@/components/setup-notice';
import { PlayerStatistics, PlayerSummary } from '@/components/player-statistics';
import { playerStatistics } from '@/domain/statistics';
import { splitSocialAndTrackerLinks } from '@/domain/validation';
import { TrackerUidTags } from '@/components/tracker-uid-tags';
import { ProfileIdentity } from '@/components/profile-identity';
import { GamerRoom } from '@/components/gamer-room';
import { BadgeGallery } from '@/components/badge-gallery';
import { playerBadges } from '@/services/badges';
import { dossierFor } from '@/repositories/dossier';
import { profileDossier } from '@/domain/dossier';
import { ProfilePresenceBadge } from '@/components/profile-presence-badge';
import { ProfileContentTabs } from '@/components/profile-content-tabs';
import { VaultRoom } from '@/components/vault-room';
import { hardwareForDisplay } from '@/domain/hardware';
import { StatsDossier, HardwareBadges } from '@/components/profile-dossier';
import { MemoryCardExport } from '@/components/memory-card-export';
import { AchievementsShowcase } from '@/components/achievements-showcase';
import { ProfileIndieTracker } from '@/components/profile-indie-tracker';
export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `@${username}` };
}
export default async function Player({ params }: { params: Promise<{ username: string }> }) {
  if (!isConfigured()) return <SetupNotice />;
  const { username } = await params;
  if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) notFound();
  const profile = await profileByName(username);
  if (!profile) notFound();
  const user = await currentUser(),
    db = await serverClient();
  const isOwner = user?.id === profile.id;
  const [access, following, friendship, badges, friendships, requests] = await Promise.all([
    db.rpc('can_view_library', { owner_id: profile.id }),
    user
      ? db
          .from('follows')
          .select('*')
          .eq('follower_id', user.id)
          .eq('followed_id', profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    user && user.id !== profile.id
      ? db
          .from('friendships')
          .select('*')
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${user.id})`,
          )
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    playerBadges(profile.id),
    playerFriends(profile.id),
    isOwner ? pendingFriendRequests(user!.id) : Promise.resolve({ received: [], sent: [] }),
  ]);
  [access, following, friendship].forEach((result) => dbCheck(result.error));
  const library = access.data ? await libraryFor(profile.id) : null;
  const dossier = library
    ? library.count <= 500 && library.logs.length < 1000
      ? profileDossier(library.entries, library.logs)
      : await dossierFor(profile.id)
    : null;
  const hardware = hardwareForDisplay(profile.owned_platforms);
  const favorites =
    library?.entries
      .filter((e) => e.favorite_position)
      .sort((a, b) => a.favorite_position! - b.favorite_position!) ?? [];
  const stats = library ? playerStatistics(library.entries, library.games, library.logs) : null;
  const { externalLinks, genshinUid, hsrUid } = splitSocialAndTrackerLinks(profile.social_links);
  return (
    <ProfileWallpaper
      fullScreen
      url={wallpaperForDisplay(profile.wallpaper_url, profile.id, publicEnv().url)}
    >
      <div
        className={
          profile.theme_color.startsWith('#') ? 'theme-custom' : `theme-${profile.theme_color}`
        }
        style={
          {
            '--accent': resolveThemeColor(profile.theme_color),
            '--profile-accent': resolveThemeColor(profile.theme_color),
          } as CSSProperties
        }
      >
        <div className="page-heading">
          <Link href="/players" className="text-link">
            ← Jugadores
          </Link>
          {isOwner ? (
            <div className="filter-buttons">
              <Link className="button secondary" href="/settings">
                Editar perfil
              </Link>
              <a className="button secondary" href="#player-vault">
                💾 Bóveda
              </a>
            </div>
          ) : null}
        </div>
        <GamerRoom theme={profile.room_theme}>
          <ProfileIdentity
            profile={profile}
            animateTerminal
            presenceBadge={<ProfilePresenceBadge userId={profile.id} />}
          >
            <div className="tags">
              {profile.psn_id ? (
                <span className="tag platform-tag">
                  <Image
                    src="/platforms/playstation.png"
                    alt=""
                    width={16}
                    height={16}
                    unoptimized
                  />{' '}
                  PSN: @{profile.psn_id}
                </span>
              ) : null}
              {profile.xbox_gamertag ? (
                <span className="tag platform-tag">
                  <Image src="/platforms/xbox.png" alt="" width={16} height={16} unoptimized />{' '}
                  Xbox: @{profile.xbox_gamertag}
                </span>
              ) : null}
              <TrackerUidTags genshinUid={genshinUid} hsrUid={hsrUid} />
              {Object.entries(externalLinks).map(([label, url]) => {
                const icon = resolvePlatformIcon(label);
                return (
                  <a
                    className={icon ? 'tag platform-tag' : 'tag'}
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {icon ? <Image src={icon} alt="" width={16} height={16} unoptimized /> : null}
                    {label} ↗
                  </a>
                );
              })}
            </div>
          </ProfileIdentity>
        </GamerRoom>
        {library ? (
          <>
            {' '}
            <div className="page-heading">
              <div>
                <p className="eyebrow">FOUR GAMES. ONE PLAYER.</p>
                <h2>Top 4 favoritos.</h2>
              </div>
            </div>
            <Top4SlotSelector
              favorites={favorites.flatMap((entry) => {
                const game = library.games.find((g) => g.id === entry.game_id);
                return game ? [{ game, entry }] : [];
              })}
              editable={user?.id === profile.id}
              shelf={profile.room_theme === 'retro_shelf'}
            />
            {!favorites.length ? <p className="muted">Todavía no hay favoritos fijados.</p> : null}
            <PlayerSummary
              count={library.count}
              hours={dossier?.hours ?? 0}
              completed={dossier?.completed ?? 0}
              genre={stats?.genres[0]?.[0] ?? '—'}
            />
            {library.count > 500 ? (
              <p className="notice">
                La biblioteca y las estadísticas de géneros muestran los 500 juegos recientes. El
                dossier calcula toda la biblioteca.
              </p>
            ) : null}
          </>
        ) : null}
        <nav className="tabs profile-shortcuts" aria-label="Accesos del jugador">
          {isOwner ? <a href="#player-vault">💾 Bóveda</a> : null}
          <Link href={`/tavern?tab=momentos&player=${profile.id}`}>Momentos</Link>
          <Link href={`/lists?player=${profile.id}`}>Listas</Link>
          <a href="#player-friends">Amigos ({friendships.friends.length})</a>
          <Link href={`/players/${profile.username}/wrapped`}>🎁 SaveState Wrapped →</Link>
        </nav>
        <div className="profile-dual-grid" id="player-friends">
          <HardwareBadges platforms={hardware} isOwner={isOwner} />
          <PlayerFriendsWidget
            currentUserId={user?.id ?? null}
            key={profile.id}
            friends={friendships.friends}
            available={friendships.available}
            receivedRequests={requests.received}
            sentRequests={requests.sent}
            isOwner={isOwner}
          />
        </div>
        <BadgeGallery {...badges} />
        {isOwner ? <ProfileIndieTracker /> : null}
        {user ? (
          <SocialControls
            targetId={profile.id}
            viewerId={user.id}
            following={Boolean(following.data)}
            friendship={friendship.data}
          />
        ) : (
          <Link className="accent" href="/login">
            Conecta para seguir o solicitar amistad.
          </Link>
        )}
        {!library ? (
          <div className="empty-state">
            <h2>Biblioteca visible solo para amigos.</h2>
            <p>
              El seguimiento permite ver actividad pública. Una amistad aceptada concede acceso a
              esta biblioteca.
            </p>
          </div>
        ) : (
          <ProfileContentTabs
            vault={
              isOwner ? (
                <section id="player-vault">
                  <VaultRoom />
                </section>
              ) : undefined
            }
            library={
              <section
                id="player-library"
                className={profile.room_theme === 'retro_shelf' ? 'retro-library' : undefined}
              >
                <Library {...library} editable={user?.id === profile.id} />
              </section>
            }
            statistics={
              <>
                {dossier ? <StatsDossier stats={dossier} /> : null}
                <PlayerStatistics {...library} />
              </>
            }
            showcase={
              <section id="player-showcase">
                {dossier ? (
                  <>
                    {' '}
                    <AchievementsShowcase
                      games={library.games}
                      entries={library.entries}
                      logs={library.logs}
                    />
                    <MemoryCardExport
                      data={{
                        qrCode: createMemoryCardQr(profile.username, appUrl()),
                        profile: {
                          username: profile.username,
                          avatar_url: profile.avatar_url,
                          terminal_status: profile.terminal_status,
                          owned_platforms: hardware,
                        },
                        clearRate: dossier.clearRate,
                        hours: dossier.hours,
                        favorites: favorites.flatMap((entry) => {
                          const game = library.games.find((g) => g.id === entry.game_id);
                          return game
                            ? [{ id: game.id, title: game.title, cover_url: game.cover_url }]
                            : [];
                        }),
                      }}
                    />
                  </>
                ) : null}
              </section>
            }
          />
        )}
      </div>
    </ProfileWallpaper>
  );
}
