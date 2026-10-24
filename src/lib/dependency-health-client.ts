'use client';
import { useEffect, useSyncExternalStore } from 'react';
import type { SystemHealthReport } from '@/domain/dependency-monitor';
import { startSystemStatusPolling, SYSTEM_STATUS_TIMEOUT_MS } from '@/lib/system-status-polling';
let report: SystemHealthReport | null = null;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function publishDependencyHealth(next: SystemHealthReport | null) {
  report = next;
  listeners.forEach((listener) => listener());
}
export function useDependencyHealth(poll = false) {
  const health = useSyncExternalStore(
    subscribe,
    () => report,
    () => null,
  );
  useEffect(() => {
    if (!poll) return;
    const polling = startSystemStatusPolling({
      isActive: () => document.visibilityState !== 'hidden' && navigator.onLine !== false,
      schedule(callback, delay) {
        const timer = window.setTimeout(callback, delay);
        return () => clearTimeout(timer);
      },
      async refresh(signal) {
        const requestSignal = AbortSignal.any([
          signal,
          AbortSignal.timeout(SYSTEM_STATUS_TIMEOUT_MS),
        ]);
        const response = await fetch('/api/system-status?healthOnly=1', {
          cache: 'no-store',
          signal: requestSignal,
        });
        if (!response.ok) throw new Error('Status unavailable');
        const result: { health: SystemHealthReport | null } = await response.json();
        if (!requestSignal.aborted) publishDependencyHealth(result.health);
        if (!result.health) throw new Error('No health report');
      },
    });
    document.addEventListener('visibilitychange', polling.wake);
    window.addEventListener('online', polling.wake);
    window.addEventListener('offline', polling.wake);
    return () => {
      polling.stop();
      document.removeEventListener('visibilitychange', polling.wake);
      window.removeEventListener('online', polling.wake);
      window.removeEventListener('offline', polling.wake);
    };
  }, [poll]);
  return health;
}
