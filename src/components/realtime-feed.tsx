'use client';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/integrations/supabase/browser';
import { RefreshCw } from 'lucide-react';
export function RealtimeFeed() {
  const router = useRouter();
  const [connection, setConnection] = useState('CONNECTING');
  const [seconds, setSeconds] = useState<number | null>(null);
  const [source, setSource] = useState('');
  const [pending, startTransition] = useTransition();
  const lastSignal = useRef<number | null>(null);
  const synchronize = useCallback(
    (signal: string) => {
      lastSignal.current = Date.now();
      setSeconds(0);
      setSource(signal);
      startTransition(() => router.refresh());
    },
    [router],
  );
  useEffect(() => {
    const db = browserClient();
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (!alive || document.visibilityState !== 'visible') return;
      lastSignal.current = Date.now();
      setSeconds(0);
      setSource('WebSocket');
      clearTimeout(timer);
      timer = setTimeout(() => synchronize('WebSocket'), 500);
    };
    const channel = db
      .channel('player-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        refresh,
      )
      .subscribe((status) => {
        if (alive) setConnection(status);
      });
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') synchronize('Respaldo automático');
    }, 30000);
    const clock = setInterval(() => {
      if (document.visibilityState === 'visible' && lastSignal.current !== null)
        setSeconds(Math.max(0, Math.floor((Date.now() - lastSignal.current) / 1000)));
    }, 1000);
    const visible = () => {
      if (document.visibilityState === 'visible') synchronize('Regreso a la pestaña');
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(interval);
      clearInterval(clock);
      document.removeEventListener('visibilitychange', visible);
      void db.removeChannel(channel);
    };
  }, [synchronize]);
  return (
    <div className="feed-telemetry" data-state={connection} aria-label="Telemetría de transmisión">
      <div>
        <p className="eyebrow" role="status">
          <span className="status-dot" />{' '}
          {connection === 'SUBSCRIBED'
            ? 'EN VIVO · WebSocket conectado'
            : connection === 'CONNECTING'
              ? 'Conectando WebSocket…'
              : 'WebSocket desconectado · respaldo activo'}
        </p>
        <p className="muted">
          Sincronización automática cada 30s ·{' '}
          {seconds === null
            ? 'Esperando primera señal'
            : `Última señal: hace ${seconds}s (${source})`}
        </p>
      </div>
      <button
        type="button"
        className="button secondary small"
        disabled={pending}
        onClick={() => synchronize('Sincronización manual')}
      >
        <RefreshCw size={16} aria-hidden="true" className={pending ? 'sync-spin' : undefined} />
        {pending ? 'Sincronizando…' : 'Sincronizar'}
      </button>
    </div>
  );
}
