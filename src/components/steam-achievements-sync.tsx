'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client-api';
export function SteamAchievementsSync({ id, hasProgress }: { id: string; hasProgress: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const router = useRouter();
  return (
    <div className="quick-session">
      <button
        type="button"
        className="button secondary"
        disabled={pending}
        onClick={async () => {
          if (pending) return;
          setPending(true);
          setMessage('');
          setError(false);
          try {
            const result = await api<{ message: string }>('library', {
              action: 'steam_achievements',
              id,
            });
            setMessage(result.message);
            router.refresh();
          } catch (caught) {
            setError(true);
            setMessage(caught instanceof Error ? caught.message : 'No se pudo sincronizar.');
          } finally {
            setPending(false);
          }
        }}
      >
        {pending
          ? 'Consultando logros…'
          : hasProgress
            ? '↺ Actualizar logros de Steam'
            : '🏆 Sincronizar logros de Steam'}
      </button>
      {message ? (
        <p role={error ? 'alert' : 'status'} className={error ? 'error-text' : 'muted'}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
