import { serverClient } from '@/integrations/supabase/server';
import { currentUser } from '@/lib/session';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/setup-notice';
import { dbCheck } from '@/lib/http';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ReadNotification } from '@/components/notification-button';
import { NOTIFICATION_LABELS } from '@/domain/notifications';
export default async function Notifications() {
  if (!isConfigured()) return <SetupNotice />;
  const user = await currentUser();
  if (!user) redirect('/login?next=/notifications');
  const db = await serverClient();
  const { data: rows, error } = await db
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  dbCheck(error);
  const actorIds = [...new Set((rows ?? []).map((row) => row.actor_id))];
  const badgeIds = [
    ...new Set((rows ?? []).flatMap((row) => (row.badge_id ? [row.badge_id] : []))),
  ];
  const threadIds = [
    ...new Set((rows ?? []).flatMap((row) => (row.forum_thread_id ? [row.forum_thread_id] : []))),
  ];
  const trackerIds = [
    ...new Set((rows ?? []).flatMap((row) => (row.itch_tracker_id ? [row.itch_tracker_id] : []))),
  ];
  const [playersResult, badges, threads, trackers] = await Promise.all([
    actorIds.length
      ? db.from('profiles').select('id,username').in('id', actorIds)
      : Promise.resolve({ data: [], error: null }),
    badgeIds.length
      ? db.from('badges').select('id,name').in('id', badgeIds)
      : Promise.resolve({ data: [], error: null }),
    threadIds.length
      ? db.from('forum_threads').select('id,category_id').in('id', threadIds)
      : Promise.resolve({ data: [], error: null }),
    trackerIds.length
      ? db.from('itch_trackers').select('id,metadata').in('id', trackerIds).eq('user_id', user.id)
      : Promise.resolve({ data: [], error: null }),
  ]);
  [playersResult, badges, threads, trackers].forEach((result) => dbCheck(result.error));
  const players = playersResult.data;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">INCOMING SIGNALS</p>
          <h1>Notificaciones.</h1>
        </div>
      </div>
      <section className="panel">
        {rows?.map((row) => {
          const name = players?.find((p) => p.id === row.actor_id)?.username;
          const thread = threads.data?.find((t) => t.id === row.forum_thread_id);
          return (
            <div className="player-row" key={row.id}>
              <p>
                <Link
                  className="accent"
                  href={
                    row.itch_tracker_id && name
                      ? `/players/${encodeURIComponent(name)}#itch-${row.itch_tracker_id}`
                      : thread
                        ? `/forum/${thread.category_id}/${thread.id}`
                        : name
                          ? `/players/${name}${row.kind === 'badge_unlocked' ? '#player-badges' : ''}`
                          : '/players'
                  }
                >
                  @{name ?? 'jugador'}
                </Link>{' '}
                {NOTIFICATION_LABELS[row.kind] ?? 'envió una señal'}
                {row.itch_tracker_id
                  ? `: ${trackers.data?.find((tracker) => tracker.id === row.itch_tracker_id)?.metadata.title ?? 'Juego indie'}`
                  : ''}
                {row.badge_id
                  ? `: ${badges.data?.find((badge) => badge.id === row.badge_id)?.name ?? 'Logro retro'}`
                  : ''}
                . {row.read_at ? '✓' : ''}
              </p>
              {!row.read_at ? <ReadNotification id={row.id} /> : null}
            </div>
          );
        })}
        {!rows?.length ? <p className="muted">No hay señales pendientes.</p> : null}
      </section>
    </>
  );
}
