'use client';
import { useEffect, useRef, useState } from 'react';
import { readJsonResponse } from '@/lib/api-response';
type GameChoice = { id: string; title: string; slug: string };
export function DiscordGamePicker({
  onSelect,
  onClose,
}: {
  onSelect: (game: GameChoice) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [games, setGames] = useState<GameChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/discord/games?${new URLSearchParams({ q: query.trim() })}`,
          { signal: controller.signal, cache: 'no-store' },
        );
        const data = await readJsonResponse<{ games: GameChoice[] }>(response);
        if (!controller.signal.aborted) setGames(data.games);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'No se pudo buscar.');
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return (
    <section className="discord-compose-picker" aria-label="Compartir juego del catálogo">
      <div className="discord-compose-picker-heading">
        <strong>🎮 Compartir juego</strong>
        <button type="button" className="button outline small" onClick={onClose}>
          ✕ Cerrar
        </button>
      </div>
      <label>
        Buscar en el catálogo local
        <input
          ref={input}
          maxLength={80}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setGames([]);
            setError('');
            setBusy(event.target.value.trim().length >= 2);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
        />
      </label>
      {busy && <p role="status">Buscando…</p>}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {!busy && query.trim().length >= 2 && !games.length && !error && (
        <p className="muted">No hay coincidencias en el catálogo local.</p>
      )}
      <ul>
        {games.map((game) => (
          <li key={game.id}>
            <button type="button" className="button outline small" onClick={() => onSelect(game)}>
              {game.title} ↗
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
