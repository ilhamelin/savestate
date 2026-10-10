import Link from 'next/link';
import { serverClient } from '@/integrations/supabase/server';
import { currentUser } from '@/lib/session';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/setup-notice';
import { RealtimeFeed } from '@/components/realtime-feed';
import { dbCheck } from '@/lib/http';
import { FeedActivityCard } from '@/components/feed-activity-card';
import { redirect } from 'next/navigation';
export const metadata = { title: 'Transmisión' };
const filters = [
  { id: 'all', label: 'Todos' },
  { id: 'platinum', label: '🏆 Platinados' },
  { id: 'rated', label: '⭐ Con Nota' },
  { id: 'playing', label: '🎮 Jugando' },
] as const;
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  if (!isConfigured()) return <SetupNotice />;
  const user = await currentUser();
  if (!user) redirect('/login?next=/feed');
  const requested = (await searchParams).filter;
  const filter = filters.find((item) => item.id === requested)?.id ?? 'all';
  const db = await serverClient();
  const [followResult, friendResult] = await Promise.all([
    db.from('follows').select('*').eq('follower_id', user.id),
    db
      .from('friendships')
      .select('*')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
  ]);
  dbCheck(followResult.error);
  dbCheck(friendResult.error);
  const ids = [
    ...new Set([
      user.id,
      ...(followResult.data ?? []).map((f) => f.followed_id),
      ...(friendResult.data ?? []).map((f) =>
        f.sender_id === user.id ? f.receiver_id : f.sender_id,
      ),
    ]),
  ];
  let query = db
    .from('activity_logs')
    .select('*')
    .in('user_id', ids)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (filter === 'platinum' || filter === 'playing')
    query = query.eq('event_data->>status', filter);
  if (filter === 'rated') query = query.not('event_data->>rating', 'is', null);
  const { data: events, error } = await query.limit(50);
  dbCheck(error);
  const gameIds = [...new Set((events ?? []).map((event) => event.target_game_id).filter(Boolean))];
  const [players, games] = await Promise.all([
    db.from('profiles').select('*').in('id', ids),
    gameIds.length
      ? db.from('games').select('*').in('id', gameIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  dbCheck(players.error);
  dbCheck(games.error);
  const playerById = new Map(players.data?.map((player) => [player.id, player]));
  const gameById = new Map(games.data?.map((game) => [game.id, game]));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ACTIVITY TRANSMISSION</p>
          <h1>La partida sigue.</h1>
          <p>Checkpoints de tus amigos y de los jugadores que sigues.</p>
        </div>
      </div>
      <RealtimeFeed />
      <nav className="filter-buttons feed-filters" aria-label="Filtrar actividad">
        {filters.map((item) => (
          <Link
            key={item.id}
            href={item.id === 'all' ? '/feed' : `/feed?filter=${item.id}`}
            className={`button small ${filter === item.id ? '' : 'outline'}`}
            aria-current={filter === item.id ? 'page' : undefined}
            scroll={false}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <section className="feed-cards" aria-label="Actividad de jugadores">
        {events?.map((event) => {
          return (
            <FeedActivityCard
              key={event.id}
              event={event}
              player={playerById.get(event.user_id)}
              game={gameById.get(event.target_game_id)}
            />
          );
        })}
        {!events?.length ? (
          <div className="empty-state">
            <h2>
              {filter === 'all'
                ? 'La transmisión está en silencio.'
                : 'No hay checkpoints con este filtro.'}
            </h2>
            <Link className="button" href="/players">
              Encuentra jugadores
            </Link>
          </div>
        ) : null}
      </section>
    </>
  );
}
