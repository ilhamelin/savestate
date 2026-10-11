'use client';
import { useOnlineUsers } from '@/lib/presence';

export function ProfilePresenceBadge({ userId }: { userId: string }) {
  const online = useOnlineUsers().has(userId);
  return (
    <span className={`friend-presence profile-presence ${online ? 'is-online' : 'is-offline'}`}>
      <span aria-hidden="true">{online ? '●' : '○'}</span>
      {online ? 'Activo' : 'Inactivo'}
    </span>
  );
}
