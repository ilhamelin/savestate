'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { api } from '@/lib/client-api';
import { readJsonResponse } from '@/lib/api-response';
import type { SteamSyncState } from '@/domain/steam-sync';
type SyncResult = {
  updatedCount: number;
  hoursAdded: number;
  remainingSlots: number;
  resetAt: string;
};
export function SteamQuickSync({ initial }: { initial: SteamSyncState }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const router = useRouter();
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    async function status() {
      try {
        const response = await fetch('/api/steam/sync', {
          signal: controller.signal,
          cache: 'no-store',
        });
        const next = await readJsonResponse<SteamSyncState>(response);
        if (!controller.signal.aborted) setState(next);
      } catch {
        /* Retain the last authoritative status; POST still enforces the quota. */
      }
    }
    const visible = () => {
      if (document.visibilityState === 'visible') void status();
    };
    // The exhausted button automatically becomes available after the UTC boundary.
    const midnight = setTimeout(
      () => void status(),
      Math.max(1000, new Date(state.resetAt).getTime() - Date.now() + 1000),
    );
    document.addEventListener('visibilitychange', visible);
    return () => {
      alive.current = false;
      controller.abort();
      clearTimeout(midnight);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [state.resetAt]);
  async function synchronize() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    setError(false);
    try {
      const result = await api<SyncResult>('steam/sync', {});
      if (!alive.current) return;
      setState((previous) => ({
        ...previous,
        remainingSlots: result.remainingSlots,
        resetAt: result.resetAt,
      }));
      setMessage(
        `✓ ${result.updatedCount} juegos actualizados (+${result.hoursAdded.toFixed(2)} h). Te quedan ${result.remainingSlots} intentos hoy.`,
      );
      router.refresh();
    } catch (failure) {
      if (alive.current) {
        setError(true);
        setMessage(failure instanceof Error ? failure.message : 'No se pudo sincronizar Steam.');
      }
      // An upstream failure also consumed a slot. Read its actual state, never guess.
      try {
        const response = await fetch('/api/steam/sync', { cache: 'no-store' });
        const next = await readJsonResponse<SteamSyncState>(response);
        if (alive.current) setState(next);
      } catch {
        /* The next visibility/status refresh can recover this read. */
      }
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const exhausted = state.remainingSlots === 0;
  return (
    <section className="panel form-stack" aria-label="Sincronización rápida de Steam">
      <h2>Horas de Steam al día</h2>
      <p className="muted">
        Actualiza solo juegos enlazados, conservando estados, notas y partidas manuales.
      </p>
      {state.message ? <p className="notice">{state.message}</p> : null}
      {!state.linked && state.available ? (
        <p>
          <Link className="text-link" href="/library/import">
            Vincular una cuenta desde el importador →
          </Link>
        </p>
      ) : null}
      <button
        type="button"
        className="button secondary"
        disabled={busy || exhausted || !state.linked || !state.configured || !state.available}
        onClick={() => void synchronize()}
      >
        <RefreshCw size={16} aria-hidden="true" className={busy ? 'sync-spin' : undefined} />
        {busy
          ? 'Sincronizando con Valve…'
          : exhausted
            ? '0/3 · Vuelve mañana'
            : `Sincronizar Steam · ${state.remainingSlots}/3 disponibles hoy`}
      </button>
      <p className="muted">
        Cuota por día calendario UTC. Los intentos que llegan a Steam consumen un uso, incluso si
        Steam falla.
      </p>
      {message ? (
        <p role={error ? 'alert' : 'status'} className={error ? 'error-text' : 'accent'}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
