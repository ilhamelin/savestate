'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/integrations/supabase/browser';
export function RealtimeFeed() {
  const router = useRouter();
  useEffect(() => {
    const db = browserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 500);
    };
    const channel = db
      .channel('player-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        refresh,
      )
      .subscribe();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      void db.removeChannel(channel);
    };
  }, [router]);
  return (
    <p className="eyebrow">
      <span className="status-dot" /> ACTUALIZACIONES EN VIVO · PRIVACIDAD VERIFICADA
    </p>
  );
}
