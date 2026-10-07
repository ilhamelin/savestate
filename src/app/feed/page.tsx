import Link from 'next/link';
import { serverClient } from '@/integrations/supabase/server';
import { currentUser } from '@/lib/session';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/setup-notice';
import { RealtimeFeed } from '@/components/realtime-feed';
import { dbCheck } from '@/lib/http';
import { STATUS_LABELS, type GameStatus } from '@/domain/model';
import { redirect } from 'next/navigation';
export const metadata = { title: 'Transmisión' };
export default async function FeedPage() {
  if (!isConfigured()) return <SetupNotice />;
  const user = await currentUser();
  if (!user) redirect('/login?next=/feed');
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
  const { data: events, error } = await db
    .from('activity_logs')
    .select('*')
    .in('user_id', ids)
    .order('created_at', { ascending: false })
    .limit(50);
  dbCheck(error);
  const [players, games] = await Promise.all([
    db.from('profiles').select('*').in('id', ids),
    events?.length
      ? db
          .from('games')
          .select('*')
          .in(
            'id',
            events.map((e) => e.target_game_id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);
  dbCheck(players.error);
  dbCheck(games.error);
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
      <section className="panel">
        {events?.map((event) => {
          const player = players.data?.find((p) => p.id === event.user_id),
            game = games.data?.find((g) => g.id === event.target_game_id);
          const state = STATUS_LABELS[event.event_data.status as GameStatus] ?? 'Actualizado';
          return (
            <article className="feed-item" key={event.id}>
              <span className="accent" aria-hidden="true">
                ▣
              </span>
              <div>
                <p>
                  <Link className="accent" href={`/players/${player?.username}`}>
                    @{player?.username}
                  </Link>{' '}
                  guardó un checkpoint en{' '}
                  <Link className="accent" href={`/games/${game?.slug}`}>
                    {game?.title}
                  </Link>
                </p>
                <small>
                  [{state}]{' '}
                  {typeof event.event_data.rating === 'number'
                    ? `· ★ ${event.event_data.rating}/10 `
                    : ''}
                  · {new Date(event.created_at).toISOString().slice(0, 10)}
                </small>
              </div>
            </article>
          );
        })}
        {!events?.length ? (
          <div className="empty-state">
            <h2>La transmisión está en silencio.</h2>
            <Link className="button" href="/players">
              Encuentra jugadores
            </Link>
          </div>
        ) : null}
      </section>
    </>
  );
}
