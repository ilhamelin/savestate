'use client';
import { useEffect, useRef, useState } from 'react';
import { PlayerRewards } from './player-rewards';

export interface ManagedPlayer {
  id: string;
  username: string;
  access_locked?: boolean;
}
export function PlayerManagementDialog({
  player,
  adminId,
  onClose,
  onUpdated,
}: {
  player: ManagedPlayer;
  adminId: string;
  onClose: () => void;
  onUpdated: (action: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [action, setAction] = useState<'reset' | 'delete' | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [whisper, setWhisper] = useState('');
  const isSelf = player.id === adminId;
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  async function submit(value: 'lock' | 'unlock' | 'reset' | 'delete') {
    if (busy || isSelf) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/guardian/players/${encodeURIComponent(player.id)}/action`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: value, confirmation }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'No se pudo completar la acción.');
      onUpdated(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  }
  async function signal(kind: 'kick' | 'whisper') {
    if (busy || isSelf) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/guardian/players/${encodeURIComponent(player.id)}/${kind}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(kind === 'whisper' ? { message: whisper } : {}),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.data?.sent)
        throw new Error(result.error ?? 'No se pudo enviar la señal.');
      onUpdated(kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la señal.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="guardian-management-dialog"
      aria-labelledby="guardian-management-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={onClose}
    >
      <header>
        <h2 id="guardian-management-title">⚙️ Administrar @{player.username}</h2>
        <button type="button" className="button outline small" disabled={busy} onClick={onClose}>
          ✕ Cerrar
        </button>
      </header>
      <p>{player.access_locked ? '🔒 Acceso Bloqueado' : '🟢 Acceso Normal'}</p>
      <PlayerRewards playerId={player.id} onUpdated={() => onUpdated('reward')} />
      {isSelf ? (
        <p className="notice">
          🛡️ Inmunidad de Operador: Acciones destructivas bloqueadas en tu propia cuenta.
        </p>
      ) : (
        <>
          <div className="guardian-management-actions">
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={() => void signal('kick')}
            >
              ⚡ Kick en Vivo (Desconectar)
            </button>
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={() => void submit(player.access_locked ? 'unlock' : 'lock')}
            >
              {player.access_locked
                ? '🔓 Desbloquear acceso'
                : '🔒 Bloquear acceso (Obligar a pedir código)'}
            </button>
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={() => {
                setAction('reset');
                setConfirmation('');
              }}
            >
              🔄 Reiniciar cuenta a Nivel 1
            </button>
            <button
              type="button"
              className="button guardian-danger"
              disabled={busy}
              onClick={() => {
                setAction('delete');
                setConfirmation('');
              }}
            >
              🗑️ Eliminar cuenta definitivamente
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void signal('whisper');
            }}
          >
            <label>
              💬 Enviar Susurro
              <input
                value={whisper}
                maxLength={140}
                required
                disabled={busy}
                onChange={(event) => setWhisper(event.target.value)}
                placeholder="Mensaje privado del Operador…"
              />
            </label>
            <small>{whisper.length}/140 · Solo visible para este jugador conectado</small>
            <button type="submit" className="button outline" disabled={busy || !whisper.trim()}>
              Enviar susurro
            </button>
          </form>
          {action && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit(action);
              }}
            >
              <p className="notice">
                {action === 'delete'
                  ? 'El borrado es irreversible: se eliminarán la cuenta, sus registros y archivos.'
                  : 'Se eliminarán biblioteca, insignias, bóveda y progreso de XP. Se conservarán las credenciales.'}
              </p>
              <label>
                Escribe {player.username} para confirmar
                <input
                  autoComplete="off"
                  value={confirmation}
                  disabled={busy}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
              <button
                type="submit"
                className="button guardian-danger"
                disabled={busy || confirmation !== player.username}
              >
                {busy
                  ? 'Procesando…'
                  : action === 'delete'
                    ? 'Confirmar borrado definitivo'
                    : 'Confirmar reinicio'}
              </button>
            </form>
          )}
        </>
      )}
      {busy && <p role="status">Procesando. Espera antes de cerrar Guardian.</p>}
      {error && <p role="alert">{error}</p>}
    </dialog>
  );
}
