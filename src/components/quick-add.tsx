'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client-api';
import { STATUS_LABELS, type GameStatus, type UserGame } from '@/domain/model';
export function QuickAdd({ gameId, authenticated }: { gameId: string; authenticated: boolean }) {
  const [status, setStatus] = useState<GameStatus>('backlog');
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<UserGame | null>(null);
  const [error, setError] = useState('');
  if (!authenticated)
    return (
      <Link className="text-link" href="/login">
        Inicia sesión para agregar
      </Link>
    );
  return (
    <div className="form-stack">
      {saved ? (
        <Link href="/library" className="text-link">
          En tu biblioteca: {STATUS_LABELS[saved.status]} ↗
        </Link>
      ) : (
        <>
          <label>
            Agregar a
            <select
              value={status}
              disabled={pending}
              onChange={(event) => setStatus(event.target.value as GameStatus)}
            >
              {(['backlog', 'wishlist', 'playing'] as const).map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button secondary"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError('');
              try {
                setSaved(
                  await api<UserGame>('library', { action: 'add', game_id: gameId, status }),
                );
              } catch (error) {
                setError(error instanceof Error ? error.message : 'No se pudo agregar.');
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? 'Agregando…' : '+ Biblioteca'}
          </button>
        </>
      )}
      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
