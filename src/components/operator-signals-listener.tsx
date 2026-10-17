'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/integrations/supabase/browser';
import { operatorSignalPayload } from '@/domain/operator-signals';

export function OperatorSignalsListener({ userId }: { userId: string | null }) {
  const router = useRouter();
  const [notice, setNotice] = useState<{
    userId: string;
    sender: string;
    message: string;
    kicked: boolean;
  } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let disposed = false,
      kicking = false;
    const seen = new Set<string>();
    let cleanup: (() => void) | undefined;
    async function connect() {
      try {
        const db = browserClient();
        await db.realtime.setAuth();
        if (disposed) return;
        const channel = db.channel(`savestate:operator:${userId}`, { config: { private: true } });
        const receive =
          (kicked: boolean) =>
          async ({ payload }: { payload: unknown }) => {
            const value = operatorSignalPayload(payload, userId!);
            if (disposed || !value || seen.has(value.id) || (!kicked && !value.message)) return;
            if (seen.size >= 100) seen.clear();
            seen.add(value.id);
            if (kicked) {
              if (kicking) return;
              kicking = true;
              setNotice({
                userId: value.userId,
                sender: value.sender,
                message: 'Has sido desconectado por el Operador del Sistema.',
                kicked: true,
              });
              try {
                const result = await db.auth.signOut();
                if (result.error) await db.auth.signOut({ scope: 'local' });
              } catch {
                await db.auth.signOut({ scope: 'local' }).catch(() => undefined);
              } finally {
                if (!disposed) {
                  router.replace('/');
                  router.refresh();
                }
              }
            } else {
              setNotice({
                userId: value.userId,
                sender: value.sender,
                message: value.message!,
                kicked: false,
              });
            }
          };
        channel
          .on('broadcast', { event: 'operator_kick' }, receive(true))
          .on('broadcast', { event: 'operator_whisper' }, receive(false))
          .subscribe();
        cleanup = () => {
          void db.removeChannel(channel);
        };
      } catch {
        // Realtime is optional; network failures must not interrupt normal navigation.
      }
    }
    void connect();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [userId, router]);
  if (!notice || (!notice.kicked && notice.userId !== userId)) return null;
  return (
    <aside
      className={`operator-hologram${notice.kicked ? ' is-kick' : ''}`}
      aria-label="Mensaje privado del operador"
    >
      <div role="status">
        <strong>
          {notice.kicked ? '⚡ SEÑAL DEL SISTEMA' : `💬 SUSURRO DE @${notice.sender}`}
        </strong>
        <p>{notice.message}</p>
      </div>
      <button
        type="button"
        onClick={() => setNotice(null)}
        aria-label="Cerrar mensaje del operador"
      >
        ✕
      </button>
    </aside>
  );
}
