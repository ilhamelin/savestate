import 'server-only';
import { authenticated } from '@/lib/session';
import { dbCheck } from '@/lib/http';
import type { NotificationSummary } from '@/domain/notifications';

export async function notificationSummary(): Promise<NotificationSummary> {
  const { db, user } = await authenticated();
  const [recent, unread] = await Promise.all([
    db
      .from('notifications')
      .select('id,kind,read_at,created_at,actor_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(5),
    db
      .from('notifications')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', user.id)
      .is('read_at', null),
  ]);
  dbCheck(recent.error);
  dbCheck(unread.error);
  const rows = recent.data ?? [];
  const profiles = rows.length
    ? await db
        .from('profiles')
        .select('id,username')
        .in('id', [...new Set(rows.map((n) => n.actor_id))])
    : { data: [], error: null };
  dbCheck(profiles.error);
  return {
    unreadCount: unread.count ?? 0,
    generatedAt: new Date().toISOString(),
    items: rows.map(({ actor_id, ...row }) => ({
      ...row,
      username: profiles.data?.find((p) => p.id === actor_id)?.username ?? null,
    })),
  };
}
