'use client';
import { api } from '@/lib/client-api';
import { ActionButton } from '@/components/ui/form';
import type { Friendship } from '@/domain/model';
export function SocialControls({
  targetId,
  viewerId,
  following,
  friendship,
}: {
  targetId: string;
  viewerId: string;
  following: boolean;
  friendship: Friendship | null;
}) {
  if (targetId === viewerId) return null;
  return (
    <div className="inline-actions">
      <ActionButton
        action={() =>
          api('social', { action: following ? 'unfollow' : 'follow', user_id: targetId })
        }
      >
        {following ? 'Dejar de seguir' : '+ Seguir'}
      </ActionButton>
      {!friendship ? (
        <ActionButton action={() => api('social', { action: 'request', user_id: targetId })}>
          Solicitar amistad
        </ActionButton>
      ) : friendship.status === 'pending' && friendship.receiver_id === viewerId ? (
        <>
          <ActionButton
            action={() =>
              api('social', { action: 'respond', id: friendship.id, status: 'accepted' })
            }
          >
            Aceptar amistad
          </ActionButton>
          <ActionButton
            action={() =>
              api('social', { action: 'respond', id: friendship.id, status: 'rejected' })
            }
          >
            Rechazar
          </ActionButton>
        </>
      ) : (
        <ActionButton action={() => api('social', { action: 'remove', id: friendship.id })}>
          {friendship.status === 'accepted'
            ? 'Eliminar amistad'
            : friendship.status === 'pending'
              ? 'Cancelar solicitud'
              : 'Limpiar solicitud rechazada'}
        </ActionButton>
      )}
    </div>
  );
}
