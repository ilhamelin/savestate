import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { profileByName, libraryFor } from '@/repositories/player';
import { serverClient } from '@/integrations/supabase/server';
import { currentUser } from '@/lib/session';
import { isConfigured } from '@/lib/env';
import { dbCheck } from '@/lib/http';
import { Library } from '@/components/library';
import { GameCard } from '@/components/game-card';
import { SocialControls } from '@/components/social-controls';
import { SetupNotice } from '@/components/setup-notice';
import { PlayerStatistics } from '@/components/player-statistics';
import { playerStatistics } from '@/domain/statistics';
import { socialLinks } from '@/domain/validation';
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
  const [access, following, friendship] = await Promise.all([
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
  ]);
  [access, following, friendship].forEach((result) => dbCheck(result.error));
  const library = access.data ? await libraryFor(profile.id) : null;
  const favorites =
    library?.entries
      .filter((e) => e.favorite_position)
      .sort((a, b) => a.favorite_position! - b.favorite_position!) ?? [];
  const stats = library ? playerStatistics(library.entries, library.games, library.logs) : null;
  const links: Record<string, string> = {};
  for (const [key, value] of Object.entries(profile.social_links)) {
    try {
      Object.assign(links, socialLinks({ [key]: value }));
    } catch {
      /* Stored links are untrusted, including direct database writes. */
    }
  }
  return (
    <div className={`theme-${profile.theme_color}`}>
      <div className="page-heading">
        <Link href="/players" className="text-link">
          ← Jugadores
        </Link>
        {user?.id === profile.id ? (
          <Link className="button secondary" href="/settings">
            Editar perfil
          </Link>
        ) : null}
      </div>
      <div className="profile-banner">
        {profile.banner_url ? (
          <Image src={profile.banner_url} alt="Banner del jugador" fill sizes="100vw" unoptimized />
        ) : null}
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
        </div>
        <div>
          <p className="eyebrow">PLAYER PROFILE</p>
          <h1>@{profile.username}</h1>
          <p className="profile-terminal">
            {profile.username}@savestate:~$ {profile.terminal_status || 'Ready to play'}
          </p>
          <div className="tags">
            {Object.entries(links).map(([label, url]) => (
              <a className="tag" key={label} href={url} target="_blank" rel="noopener noreferrer">
                {label} ↗
              </a>
            ))}
          </div>
        </div>
      </div>
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
            El seguimiento permite ver actividad pública. Una amistad aceptada concede acceso a esta
            biblioteca.
          </p>
        </div>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">FOUR GAMES. ONE PLAYER.</p>
              <h2>Top 4 favoritos.</h2>
            </div>
          </div>
          <div className="game-grid">
            {favorites.map((entry) => {
              const game = library.games.find((g) => g.id === entry.game_id);
              return game ? <GameCard key={entry.id} game={game} score={entry.rating} /> : null;
            })}
          </div>
          {!favorites.length ? <p className="muted">Todavía no hay favoritos fijados.</p> : null}
          <section className="stats-grid">
            {[
              [library.count, 'Juegos'],
              [stats?.hours.toFixed(1) ?? '0', 'Horas registradas'],
              [
                library.entries.filter((e) => ['cleared', 'platinum'].includes(e.status)).length,
                'Completados',
              ],
              [stats?.genres[0]?.[0] ?? '—', 'Género más jugado'],
            ].map(([value, label]) => (
              <div className="stat" key={label}>
                <strong style={label === 'Género más jugado' ? { fontSize: 15 } : undefined}>
                  {value}
                </strong>
                <span>{label}</span>
              </div>
            ))}
          </section>
          {library.count > 500 ? (
            <p className="notice">
              Estados y géneros calculados sobre los 500 juegos recientes mostrados.
            </p>
          ) : null}
          <nav className="tabs" aria-label="Secciones del perfil">
            <a href="#player-library">Biblioteca</a>
            <a href="#player-stats">Estadísticas</a>
            <Link href={`/lists?player=${profile.id}`}>Listas</Link>
          </nav>
          <PlayerStatistics {...library} />
          <section id="player-library">
            <Library {...library} editable={user?.id === profile.id} />
          </section>
        </>
      )}
    </div>
  );
}
