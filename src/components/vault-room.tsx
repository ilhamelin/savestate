'use client';
import { VaultVideo } from '@/components/vault-video';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { readJsonResponse } from '@/lib/api-response';
import {
  VAULT_MIMES,
  validateVaultFile,
  vaultHasSpace,
  vaultCapacity,
  vaultMegabytes,
  type VaultItem,
  type VaultSnapshot,
} from '@/domain/vault';

async function vaultRequest<T>(method: string, input?: unknown): Promise<T> {
  const response = await fetch('/api/vault', {
    method,
    cache: 'no-store',
    headers: input ? { 'Content-Type': 'application/json' } : undefined,
    body: input ? JSON.stringify(input) : undefined,
  });
  if (method === 'GET') return readJsonResponse<T>(response);
  return (await readJsonResponse<{ data: T }>(response)).data;
}
function VaultPreview({ item }: { item: VaultItem }) {
  return item.mime_type.startsWith('video/') ? (
    <VaultVideo
      src={item.publicUrl}
      controls
      preload="metadata"
      playsInline
      aria-label={item.file_name}
    />
  ) : (
    <Image src={item.publicUrl} alt={item.file_name} width={480} height={320} unoptimized />
  );
}
export function VaultRoom({ onSelect }: { onSelect?: (item: VaultItem) => void }) {
  const [snapshot, setSnapshot] = useState<VaultSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [active, setActive] = useState<VaultItem | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let mounted = true;
    vaultRequest<VaultSnapshot>('GET')
      .then((data) => {
        if (mounted) setSnapshot(data);
      })
      .catch((failure) => {
        if (mounted) setError(failure.message);
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (active && !dialog.current?.open) dialog.current?.showModal();
  }, [active]);
  async function upload(selected?: File) {
    if (!selected || !snapshot || busy) return;
    setError('');
    setNotice('');
    try {
      validateVaultFile(selected.name, selected.size, selected.type);
      if (!vaultHasSpace(snapshot.storage, selected.size))
        throw new Error('El archivo supera el espacio libre de tu Memory Card.');
      setBusy(true);
      const prepared = await vaultRequest<{
        id: string;
        presignedUrl: string;
        headers: Record<string, string>;
      }>('POST', { fileName: selected.name, fileSize: selected.size, mimeType: selected.type });
      setNotice('Subiendo directamente a R2… No cierres esta ventana.');
      const uploaded = await fetch(prepared.presignedUrl, {
        method: 'PUT',
        headers: prepared.headers,
        body: selected,
      });
      if (!uploaded.ok)
        throw new Error(
          'R2 rechazó la subida. Revisa la conexión y la configuración CORS del bucket.',
        );
      setSnapshot(await vaultRequest<VaultSnapshot>('PUT', { id: prepared.id }));
      setNotice('💾 Checkpoint guardado en tu bóveda.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo subir.');
      setNotice('');
      try {
        setSnapshot(await vaultRequest<VaultSnapshot>('GET'));
      } catch {
        /* Keep the last known quota. */
      }
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  }
  async function action(item: VaultItem, method: 'PUT' | 'DELETE') {
    if (
      busy ||
      (method === 'DELETE' && !window.confirm(`¿Eliminar ${item.file_name} de la bóveda?`))
    )
      return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setSnapshot(await vaultRequest<VaultSnapshot>(method, { id: item.id }));
      setNotice(
        method === 'DELETE' ? 'Archivo eliminado; memoria actualizada.' : 'Subida confirmada.',
      );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const capacity = snapshot ? vaultCapacity(snapshot.storage) : null;
  return (
    <section className="vault-room" aria-label="Bóveda multimedia">
      <header className="page-heading">
        <div>
          <p className="eyebrow">CYBERPUNK VAULT // MEMORY CARD</p>
          <h1>{onSelect ? 'Seleccionar de mi bóveda' : 'Bóveda de checkpoints'}</h1>
          <p className="muted">
            Capturas y clips en tu Memory Card de 100 MB. Los enlaces de los archivos son públicos:
            cualquiera que tenga el enlace puede verlos.
          </p>
        </div>
      </header>
      {snapshot && capacity && (
        <div className={`panel vault-storage vault-${capacity.state}`}>
          <div className="vault-storage-heading">
            <strong>
              💾 MEMORY CARD // {vaultMegabytes(snapshot.storage.used_bytes)} MB / 100 MB
            </strong>
            <span>{Math.ceil(capacity.percent)}%</span>
          </div>
          <progress
            max={100}
            value={capacity.percent}
            aria-label="Almacenamiento utilizado y reservado"
          />
          <strong>
            {capacity.state === 'full'
              ? '⛔ BLOQUEO: MEMORIA AL 100%'
              : capacity.state === 'critical'
                ? '🚨 MEMORIA CASI LLENA'
                : capacity.state === 'warning'
                  ? `⚠️ MEMORIA AL ${Math.round(capacity.percent)}%`
                  : '🟢 CAPACIDAD NOMINAL'}
          </strong>
          {snapshot.storage.reserved_bytes > 0 && (
            <p className="muted">
              {vaultMegabytes(snapshot.storage.reserved_bytes)} MB reservados para subidas
              pendientes.
            </p>
          )}
          {capacity.state === 'full' && (
            <p role="alert">Libera espacio antes de subir otro archivo.</p>
          )}
        </div>
      )}
      {!onSelect && (
        <div className="filter-buttons">
          <input
            ref={file}
            type="file"
            accept={Object.keys(VAULT_MIMES).join(',')}
            hidden
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <button
            type="button"
            className="button"
            disabled={busy || !snapshot || capacity?.state === 'full'}
            onClick={() => file.current?.click()}
          >
            {busy ? '⏳ Procesando…' : '＋ Subir captura / clip'}
          </button>
          <span className="muted">PNG · JPG · WebP · GIF · MP4 · WebM</span>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!snapshot && !error && <p aria-busy="true">Leyendo Memory Card…</p>}
      {snapshot?.items.length === 0 && (
        <p className="panel muted">
          No hay archivos confirmados en tu bóveda.
          {onSelect && (
            <>
              {' '}
              <Link href="/vault">Añadir capturas o clips ↗</Link>
            </>
          )}
        </p>
      )}
      <div className="vault-grid">
        {snapshot?.items.map((item) => (
          <article className="vault-card" key={item.id}>
            <VaultPreview item={item} />
            <strong>{item.file_name}</strong>
            <small className="muted">{vaultMegabytes(item.file_size)} MB</small>
            <div className="filter-buttons">
              {onSelect ? (
                <button type="button" className="button small" onClick={() => onSelect(item)}>
                  Enviar al composer
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="button outline small"
                    aria-label={`Copiar enlace de ${item.file_name}`}
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(item.publicUrl)
                        .then(() => setNotice('📋 Enlace copiado.'))
                        .catch(() =>
                          setError('No se pudo copiar. Abre el archivo para copiar su enlace.'),
                        );
                    }}
                  >
                    📋
                  </button>
                  <button
                    type="button"
                    className="button outline small"
                    aria-label={`Ampliar ${item.file_name}`}
                    onClick={() => setActive(item)}
                  >
                    🔍
                  </button>
                  <button
                    type="button"
                    className="button outline small"
                    disabled={busy}
                    aria-label={`Eliminar ${item.file_name}`}
                    onClick={() => void action(item, 'DELETE')}
                  >
                    🗑️
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      {!onSelect && Boolean(snapshot?.pending.length) && (
        <details className="panel" open>
          <summary>Subidas pendientes ({snapshot?.pending.length})</summary>
          <p className="muted">
            Si la subida terminó pero falló la confirmación, reintenta. Las autorizaciones duran
            cinco minutos; después podrás eliminar subidas fallidas y liberar su reserva.
          </p>
          {snapshot?.pending.map((item) => (
            <div className="filter-buttons" key={item.id}>
              <span>{item.file_name}</span>
              <button
                type="button"
                className="button outline small"
                disabled={busy}
                onClick={() => void action(item, 'PUT')}
              >
                Confirmar subida
              </button>
              <button
                type="button"
                className="button outline small"
                disabled={busy}
                onClick={() => void action(item, 'DELETE')}
              >
                Eliminar
              </button>
            </div>
          ))}
        </details>
      )}
      <dialog ref={dialog} className="vault-dialog" onCancel={() => setActive(null)}>
        <button
          type="button"
          className="button outline small"
          onClick={() => {
            dialog.current?.close();
            setActive(null);
          }}
        >
          ✕ Cerrar
        </button>
        {active && (
          <>
            <VaultPreview item={active} />
            <a href={active.publicUrl} target="_blank" rel="noopener noreferrer">
              Abrir original ↗
            </a>
          </>
        )}
      </dialog>
    </section>
  );
}
