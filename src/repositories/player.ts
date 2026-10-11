import 'server-only';
import { serverClient } from '@/integrations/supabase/server';
import { dbCheck } from '@/lib/http';
import { authenticated } from '@/lib/session';
import type { PlayerFriend, FriendRequest } from '@/domain/player-friends';
import type { Friendship } from '@/domain/model';

export async function playerFriends(userId: string) {
  const db = await serverClient();
  const friends: PlayerFriend[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await db
      .rpc('get_player_friends', { p_user_id: userId })
      .range(offset, offset + 999);
    // Keep the rest of the profile available until migration 020 is applied.
    if (result.error?.code === 'PGRST202') return { friends: [], available: false };
    dbCheck(result.error);
    friends.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 1000) break;
  }
  return { friends, available: true };
}

// Server callers may reuse the authenticated viewer ID; RLS still protects pending requests.
export async function pendingFriendRequests(userId?: string) {
  const { db, user } = userId
    ? { db: await serverClient(), user: { id: userId } }
    : await authenticated();
  const requests: Friendship[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await db
      .from('friendships')
      .select('*')
      .eq('status', 'pending')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .order('id')
      .range(offset, offset + 999);
    dbCheck(result.error);
    requests.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 1000) break;
  }
  const ids = [
    ...new Set(requests.map((r) => (r.sender_id === user.id ? r.receiver_id : r.sender_id))),
  ];
  const profiles = new Map<string, FriendRequest['profile']>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const result = await db
      .from('profiles')
      .select('id,username,avatar_url,level,terminal_status')
      .in('id', ids.slice(offset, offset + 100));
    dbCheck(result.error);
    for (const profile of result.data ?? []) profiles.set(profile.id, profile);
  }
  const received: FriendRequest[] = [],
    sent: FriendRequest[] = [];
  for (const request of requests) {
    const profile = profiles.get(
      request.sender_id === user.id ? request.receiver_id : request.sender_id,
    );
    if (profile)
      (request.receiver_id === user.id ? received : sent).push({ id: request.id, profile });
  }
  return { received, sent };
}
export async function libraryHoursFor(userId: string) {
  const db = await serverClient();
  let total = 0;
  // Page every log, including games outside the visible 500-entry library window.
  for (let offset = 0; ; offset += 1000) {
    const result = await db
      .from('play_logs')
      .select('hours_played,user_games!inner(user_id)')
      .eq('user_games.user_id', userId)
      .order('id')
      .range(offset, offset + 999);
    dbCheck(result.error);
    for (const log of result.data ?? []) total += Math.round(Number(log.hours_played) * 100);
    if ((result.data?.length ?? 0) < 1000) break;
  }
  return total / 100;
}
export async function libraryFor(userId: string) {
  const db = await serverClient();
  const {
    data: rows,
    error,
    count,
  } = await db
    .from('user_games')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(500);
  dbCheck(error);
  const { data: favorites, error: favoriteError } = await db
    .from('user_games')
    .select('*')
    .eq('user_id', userId)
    .not('favorite_position', 'is', null)
    .order('favorite_position');
  dbCheck(favoriteError);
  const entries = [
    ...new Map([...(rows ?? []), ...(favorites ?? [])].map((entry) => [entry.id, entry])).values(),
  ];
  const ids = entries.map((row) => row.id),
    gameIds = entries.map((row) => row.game_id);
  if (!entries.length) return { entries: [], games: [], logs: [], reviews: [], count: count ?? 0 };
  const [games, logs, reviews] = await Promise.all([
    db.from('games').select('*').in('id', gameIds),
    db
      .from('play_logs')
      .select('*')
      .in('user_game_id', ids)
      .order('created_at', { ascending: false }),
    db.from('reviews').select('*').in('user_game_id', ids),
  ]);
  dbCheck(games.error);
  dbCheck(logs.error);
  dbCheck(reviews.error);
  return {
    entries,
    games: games.data ?? [],
    logs: logs.data ?? [],
    reviews: reviews.data ?? [],
    count: count ?? 0,
  };
}
export async function profileByName(name: string) {
  const db = await serverClient();
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('username_normalized', name.toLowerCase())
    .maybeSingle();
  dbCheck(error);
  return data;
}
