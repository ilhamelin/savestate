import 'server-only';
import { authenticated } from '@/lib/session';
import { dbCheck } from '@/lib/http';
import { pendingNotificationFriendship, type NotificationSummary } from '@/domain/notifications';

export async function notificationSummary(): Promise<NotificationSummary> {
  const { db, user } = await authenticated();
  const [recent, unread] = await Promise.all([
    db
      .from('notifications')
      .select('id,kind,read_at,created_at,actor_id,badge_id,forum_thread_id,itch_tracker_id')
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
  const badgeIds = [...new Set(rows.flatMap((row) => (row.badge_id ? [row.badge_id] : [])))];
  const badges = badgeIds.length
    ? await db.from('badges').select('id,name').in('id', badgeIds)
    : { data: [], error: null };
  dbCheck(badges.error);
  const threadIds = [
    ...new Set(rows.flatMap((row) => (row.forum_thread_id ? [row.forum_thread_id] : []))),
  ];
  const threads = threadIds.length
    ? await db.from('forum_threads').select('id,category_id').in('id', threadIds)
    : { data: [], error: null };
  dbCheck(threads.error);
  const requestActors = [
    ...new Set(rows.filter((row) => row.kind === 'friend_request').map((row) => row.actor_id)),
  ];
  const friendships = requestActors.length
    ? await db
        .from('friendships')
        .select('id,sender_id,created_at')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .in('sender_id', requestActors)
    : { data: [], error: null };
  dbCheck(friendships.error);
  const seenRequests = new Set<string>();
  const trackerIds = rows.flatMap((row) => (row.itch_tracker_id ? [row.itch_tracker_id] : []));
  const trackers = trackerIds.length
    ? await db
        .from('itch_trackers')
        .select('id,metadata')
        .in('id', trackerIds)
        .eq('user_id', user.id)
    : { data: [], error: null };
  dbCheck(trackers.error);
  return {
    unreadCount: unread.count ?? 0,
    generatedAt: new Date().toISOString(),
    items: rows.map(({ actor_id, ...row }) => {
      const friendshipId =
        row.kind === 'friend_request' && !seenRequests.has(actor_id)
          ? pendingNotificationFriendship({ ...row, actor_id }, friendships.data ?? [])
          : null;
      if (row.kind === 'friend_request') seenRequests.add(actor_id);
      return {
        ...row,
        trackerTitle:
          trackers.data?.find((tracker) => tracker.id === row.itch_tracker_id)?.metadata.title ??
          null,
        trackerHref: row.itch_tracker_id
          ? `/players/${profiles.data?.find((p) => p.id === user.id)?.username ?? ''}#itch-${row.itch_tracker_id}`
          : null,
        friendshipId,
        username: profiles.data?.find((p) => p.id === actor_id)?.username ?? null,
        badgeName: badges.data?.find((badge) => badge.id === row.badge_id)?.name ?? null,
        forumHref: threads.data?.find((t) => t.id === row.forum_thread_id)
          ? `/forum/${threads.data.find((t) => t.id === row.forum_thread_id)!.category_id}/${row.forum_thread_id}`
          : null,
      };
    }),
  };
}
