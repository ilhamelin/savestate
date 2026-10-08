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
  const { data: players, error: profileError } = rows?.length
    ? await db
        .from('profiles')
        .select('*')
        .in(
          'id',
          rows.map((n) => n.actor_id),
        )
    : { data: [], error: null };
  dbCheck(profileError);
  const badgeIds = [
    ...new Set((rows ?? []).flatMap((row) => (row.badge_id ? [row.badge_id] : []))),
  ];
  const badges = badgeIds.length
    ? await db.from('badges').select('id,name').in('id', badgeIds)
    : { data: [], error: null };
  dbCheck(badges.error);
  const threadIds = [
    ...new Set((rows ?? []).flatMap((row) => (row.forum_thread_id ? [row.forum_thread_id] : []))),
  ];
  const threads = threadIds.length
    ? await db.from('forum_threads').select('id,category_id').in('id', threadIds)
    : { data: [], error: null };
  dbCheck(threads.error);
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
                    thread
                      ? `/forum/${thread.category_id}/${thread.id}`
                      : name
                        ? `/players/${name}${row.kind === 'badge_unlocked' ? '#player-badges' : ''}`
                        : '/players'
                  }
                >
                  @{name ?? 'jugador'}
                </Link>{' '}
                {NOTIFICATION_LABELS[row.kind] ?? 'envió una señal'}
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
