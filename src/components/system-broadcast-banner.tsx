'use client';
import { useEffect, useState } from 'react';
import type { SystemBroadcast } from '@/domain/guardian-suite';
import { effectiveSeasonalTheme } from '@/domain/seasonal-theme';
export function SystemBroadcastBanner({
  initial,
  initialDoubleXp = false,
}: {
  initial: SystemBroadcast | null;
  initialDoubleXp?: boolean;
}) {
  const [broadcast, setBroadcast] = useState(initial);
  const [doubleXp, setDoubleXp] = useState(initialDoubleXp);
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    let running = false;
    const controller = new AbortController();
    async function refresh() {
      document.documentElement.dataset.seasonalTheme = effectiveSeasonalTheme(
        document.documentElement.dataset.seasonalTheme,
      );
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        const response = await fetch('/api/system-status', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = await response.json();
        if (!controller.signal.aborted) {
          setBroadcast(result.broadcast);
          if (typeof result.switches?.double_xp === 'boolean') {
            setDoubleXp(result.switches.double_xp);
            document.documentElement.dataset.doubleXp = String(result.switches.double_xp);
          }
          if (
            result.switches?.seasonal_theme === 'classic' ||
            result.switches?.seasonal_theme === 'halloween'
          )
            document.documentElement.dataset.seasonalTheme = effectiveSeasonalTheme(
              result.switches.seasonal_theme,
            );
        }
      } catch {
        /* Keep the last confirmed announcement during temporary outages. */
      } finally {
        running = false;
      }
    }
    const storageTimer = window.setTimeout(() => {
      try {
        setDismissed(window.sessionStorage.getItem('savestate_dismissed_broadcast'));
      } catch {
        /* Storage is optional. */
      }
    }, 0);
    void refresh();
    const timer = window.setInterval(refresh, 10000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      window.clearTimeout(storageTimer);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return (
    <>
      {doubleXp && (
        <aside className="double-xp-event" role="status">
          ⚡ EVENTO DOBLE XP ACTIVO · Tus próximos checkpoints valen x2 XP
        </aside>
      )}
      {broadcast && broadcast.id !== dismissed && (
        <aside
          className={`system-broadcast system-broadcast-${broadcast.category}`}
          aria-label="Anuncio del operador"
        >
          <p role="status">
            <strong>
              {broadcast.category === 'warning'
                ? '⚠ ALERTA'
                : broadcast.category === 'event'
                  ? '✦ EVENTO'
                  : '◉ INFORMACIÓN'}
            </strong>{' '}
            {broadcast.message}
          </p>
          <button
            type="button"
            aria-label="Descartar este anuncio"
            onClick={() => {
              setDismissed(broadcast.id);
              try {
                window.sessionStorage.setItem('savestate_dismissed_broadcast', broadcast.id);
              } catch {
                /* Storage is optional. */
              }
            }}
          >
            ✕
          </button>
        </aside>
      )}
    </>
  );
}
