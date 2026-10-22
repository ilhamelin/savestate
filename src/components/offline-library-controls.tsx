'use client';
import { useEffect, useState } from 'react';
import { useNetworkOnline } from '@/lib/use-network-online';
import { browserClient } from '@/integrations/supabase/browser';
import { prepareOfflineLibraryShell } from '@/lib/offline-library-shell';
import {
  OFFLINE_MAX_AGE_MS,
  readOfflineLibrary,
  saveOfflineLibrary,
  offlineLibraryLease,
  deleteOfflineLibrarySnapshot,
  subscribeOfflineLibrary,
  type OfflineLibraryRow,
  type OfflineLibrarySnapshot,
} from '../../public/offline-library/store.mjs';

export function OfflineLibraryControls({
  userId,
  rows,
  totalCount,
}: {
  userId: string;
  rows: OfflineLibraryRow[];
  totalCount: number;
}) {
  const online = useNetworkOnline();
  const [saved, setSaved] = useState<OfflineLibrarySnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let disposed = false,
      revision = 0;
    async function refresh() {
      const version = ++revision;
      try {
        const value = await readOfflineLibrary(userId);
        if (!disposed && version === revision) setSaved(value);
      } catch {
        if (!disposed && version === revision) setSaved(null);
      }
    }
    const unsubscribe = subscribeOfflineLibrary(() => {
      setSaved(null);
      void refresh();
    });
    void refresh();
    return () => {
      disposed = true;
      revision++;
      unsubscribe();
    };
  }, [userId]);
  async function save() {
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await browserClient().auth.getUser();
      if (error || data.user?.id !== userId)
        throw new Error('Vuelve a iniciar sesión antes de guardar tu copia.');
      const lease = offlineLibraryLease(userId);
      await prepareOfflineLibraryShell();
      const now = Date.now();
      const snapshot: OfflineLibrarySnapshot = {
        version: 1,
        ownerId: userId,
        savedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + OFFLINE_MAX_AGE_MS).toISOString(),
        totalCount,
        rows,
      };
      await saveOfflineLibrary(lease, snapshot);
      setSaved(snapshot);
      setMessage('Copia de solo lectura preparada para este dispositivo.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar la copia offline.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel offline-library-controls" aria-label="Biblioteca sin conexión">
      <p role="status" aria-live="polite" className="muted">
        <span className={online ? 'accent' : ''}>{online ? '● Online' : '○ Modo Offline'}</span>
        {' · '}
        {saved
          ? `Última sincronización: ${new Date(saved.savedAt).toLocaleString('es-CL')}`
          : 'Sin copia offline vigente'}
      </p>
      <div className="filter-buttons">
        <button
          type="button"
          className="button outline small"
          disabled={!online || busy}
          onClick={() => void save()}
        >
          {busy
            ? 'Preparando…'
            : saved
              ? 'Actualizar copia offline'
              : 'Guardar para consultar sin conexión'}
        </button>
        {saved && (
          <a className="button outline small" href="/offline-library/index.html">
            Ver copia de solo lectura ↗
          </a>
        )}
        {saved && (
          <button
            type="button"
            className="button outline small"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await deleteOfflineLibrarySnapshot(offlineLibraryLease(userId));
                setSaved(null);
                setMessage('Copia offline eliminada.');
              } catch {
                setMessage('No se pudo eliminar la copia. Inténtalo de nuevo.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Eliminar copia
          </button>
        )}
      </div>
      <p className="muted">
        Opcional en dispositivos de confianza. Guarda títulos, estados y progreso resumido durante
        12 horas; no incluye notas, reseñas ni credenciales. Actualiza manualmente para reflejar
        cambios.
      </p>
      {saved && (
        <small className="muted">
          {saved.rows.length} de {saved.totalCount} juegos guardados.
        </small>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
