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
  const actorIds = [...new Set([...rows.map((n) => n.actor_id), user.id])];
  const badgeIds = [...new Set(rows.flatMap((row) => (row.badge_id ? [row.badge_id] : [])))];
  const threadIds = [
    ...new Set(rows.flatMap((row) => (row.forum_thread_id ? [row.forum_thread_id] : []))),
  ];
  const requestActors = [
    ...new Set(rows.filter((row) => row.kind === 'friend_request').map((row) => row.actor_id)),
  ];
  const trackerIds = [
    ...new Set(rows.flatMap((row) => (row.itch_tracker_id ? [row.itch_tracker_id] : []))),
  ];
  const [profiles, badges, threads, friendships, trackers] = await Promise.all([
    rows.length
      ? db.from('profiles').select('id,username').in('id', actorIds)
      : Promise.resolve({ data: [], error: null }),
    badgeIds.length
      ? db.from('badges').select('id,name').in('id', badgeIds)
      : Promise.resolve({ data: [], error: null }),
    threadIds.length
      ? db.from('forum_threads').select('id,category_id').in('id', threadIds)
      : Promise.resolve({ data: [], error: null }),
    requestActors.length
      ? db
          .from('friendships')
          .select('id,sender_id,created_at')
          .eq('receiver_id', user.id)
          .eq('status', 'pending')
          .in('sender_id', requestActors)
      : Promise.resolve({ data: [], error: null }),
    trackerIds.length
      ? db.from('itch_trackers').select('id,metadata').in('id', trackerIds).eq('user_id', user.id)
      : Promise.resolve({ data: [], error: null }),
  ]);
  [profiles, badges, threads, friendships, trackers].forEach((result) => dbCheck(result.error));
  const seenRequests = new Set<string>();
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
