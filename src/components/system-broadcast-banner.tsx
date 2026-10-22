'use client';
import { useEffect, useState } from 'react';
import type { SystemBroadcast } from '@/domain/guardian-suite';
import { effectiveSeasonalTheme, HALLOWEEN_END_MS } from '@/domain/seasonal-theme';
import { startSystemStatusPolling, SYSTEM_STATUS_TIMEOUT_MS } from '@/lib/system-status-polling';
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
    let seasonalTimer: number | undefined;
    function updateSeasonalTheme() {
      document.documentElement.dataset.seasonalTheme = effectiveSeasonalTheme(
        document.documentElement.dataset.seasonalTheme,
      );
      const remaining = HALLOWEEN_END_MS - Date.now() + 1;
      if (remaining > 0) {
        seasonalTimer = window.setTimeout(updateSeasonalTheme, Math.min(remaining, 2_147_483_647));
      }
    }
    updateSeasonalTheme();
    const polling = startSystemStatusPolling({
      isActive: () => document.visibilityState !== 'hidden' && navigator.onLine !== false,
      schedule: (callback, delay) => {
        const timer = window.setTimeout(callback, delay);
        return () => window.clearTimeout(timer);
      },
      async refresh(signal) {
        const requestSignal = AbortSignal.any([
          signal,
          AbortSignal.timeout(SYSTEM_STATUS_TIMEOUT_MS),
        ]);
        const response = await fetch('/api/system-status', {
          cache: 'no-store',
          signal: requestSignal,
        });
        if (!response.ok) throw new Error('System status unavailable');
        const result = await response.json();
        if (requestSignal.aborted) return;
        setBroadcast(result.broadcast);
        if (typeof result.switches?.double_xp === 'boolean') {
          setDoubleXp(result.switches.double_xp);
          document.documentElement.dataset.doubleXp = String(result.switches.double_xp);
        }
        if (
          result.switches?.seasonal_theme === 'classic' ||
          result.switches?.seasonal_theme === 'halloween'
        ) {
          document.documentElement.dataset.seasonalTheme = effectiveSeasonalTheme(
            result.switches.seasonal_theme,
          );
        }
      },
    });
    const storageTimer = window.setTimeout(() => {
      try {
        setDismissed(window.sessionStorage.getItem('savestate_dismissed_broadcast'));
      } catch {
        /* Storage is optional. */
      }
    }, 0);
    document.addEventListener('visibilitychange', polling.wake);
    window.addEventListener('focus', polling.wake);
    window.addEventListener('online', polling.wake);
    window.addEventListener('offline', polling.wake);
    return () => {
      polling.stop();
      window.clearTimeout(storageTimer);
      window.clearTimeout(seasonalTimer);
      document.removeEventListener('visibilitychange', polling.wake);
      window.removeEventListener('focus', polling.wake);
      window.removeEventListener('online', polling.wake);
      window.removeEventListener('offline', polling.wake);
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
