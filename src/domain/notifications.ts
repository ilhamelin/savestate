export const NOTIFICATION_LABELS: Record<string, string> = {
  itch_update: 'tiene una nueva actualización de itch.io',
  forum_reply: 'respondió en tu hilo del foro',
  forum_quote: 'te citó en una respuesta del foro',
  badge_unlocked: 'desbloqueó un nuevo logro retro',
  follow: 'empezó a seguirte',
  friend_request: 'te envió una solicitud de amistad',
  friend_accepted: 'aceptó tu amistad',
  comment: 'comentó tu reseña',
  reaction: 'reaccionó a tu reseña',
  post_comment: 'comentó en tu momento gamer',
  post_reaction: 'reaccionó a tu momento gamer',
};
export interface NotificationSummary {
  unreadCount: number;
  generatedAt: string;
  items: {
    id: string;
    kind: string;
    read_at: string | null;
    created_at: string;
    username: string | null;
    badgeName?: string | null;
    badgeId?: string | null;
    forumHref?: string | null;
    friendshipId?: string | null;
    trackerHref?: string | null;
    trackerTitle?: string | null;
  }[];
}
export function notificationAge(createdAt: string, now: string) {
  const seconds = Math.max(0, Math.floor((Date.parse(now) - Date.parse(createdAt)) / 1000));
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return 'ahora';
  const unit = seconds < 3600 ? 'minute' : seconds < 86400 ? 'hour' : 'day';
  const divisor = unit === 'minute' ? 60 : unit === 'hour' ? 3600 : 86400;
  return new Intl.RelativeTimeFormat('es', { numeric: 'always' }).format(
    -Math.floor(seconds / divisor),
    unit,
  );
}
export function pendingNotificationFriendship(
  notification: { kind: string; actor_id: string; created_at: string },
  requests: { id: string; sender_id: string; created_at: string }[],
) {
  if (notification.kind !== 'friend_request') return null;
  return (
    requests.find(
      (request) =>
        request.sender_id === notification.actor_id &&
        Date.parse(request.created_at) <= Date.parse(notification.created_at),
    )?.id ?? null
  );
}
