'use client';
import { ActionButton } from '@/components/ui/form';
import { api } from '@/lib/client-api';
export function ReadNotification({ id }: { id: string }) {
  return (
    <ActionButton action={() => api('community', { action: 'read_notification', id })}>
      Marcar leída
    </ActionButton>
  );
}
export function ModerateReview({ id }: { id: string }) {
  return (
    <ActionButton
      danger
      action={async () => {
        if (window.confirm('¿Eliminar la reseña reportada?'))
          await api('community', { action: 'moderate_review', review_id: id });
      }}
    >
      Eliminar reseña
    </ActionButton>
  );
}
