'use client';
import { useEffect, useState } from 'react';
import type { Game } from '@/domain/model';
import { readJsonResponse } from '@/lib/api-response';
export function CataloguePicker({ games, required = true }: { games: Game[]; required?: boolean }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Game[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          `/api/catalogue?${new URLSearchParams({ q: query, offset: String(offset) })}`,
          {
            signal: controller.signal,
          },
        );
        const data = await readJsonResponse<{
          games: Game[];
          message: string | null;
          nextOffset: number | null;
        }>(response);
        if (!controller.signal.aborted) {
          setResults((previous) =>
            offset
              ? [...new Map([...previous, ...data.games].map((game) => [game.id, game])).values()]
              : data.games,
          );
          setNextOffset(data.nextOffset);
          setError(data.message ?? '');
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : 'No se pudo buscar.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, offset, attempt]);
  const choices = query.trim().length >= 2 ? results : games;
  return (
    <div className="form-stack">
      <label>
        Buscar en todo el catálogo
        <input
          type="search"
          value={query}
          maxLength={80}
          placeholder="Nombre del juego (mínimo 2 letras)"
          onChange={(event) => {
            setQuery(event.target.value);
            setLoading(event.target.value.trim().length >= 2);
            setResults([]);
            setOffset(0);
            setNextOffset(null);
            setSelected('');
            setError('');
          }}
        />
      </label>
      {nextOffset !== null ? (
        <button
          type="button"
          className="button secondary"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setOffset(nextOffset);
            setAttempt((value) => value + 1);
          }}
        >
          Cargar más resultados
        </button>
      ) : null}
      <label>
        Juego
        <select
          name="game"
          required={required}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="" disabled={required}>
            {required ? 'Selecciona un juego' : 'Sin juego relacionado'}
          </option>
          {choices.map((game) => (
            <option key={game.id} value={game.id}>
              {game.title} ({game.release_year ?? 'sin fecha'})
            </option>
          ))}
        </select>
      </label>
      <p role="status" className="muted">
        {loading
          ? 'Buscando…'
          : query.trim().length >= 2
            ? `${results.length} resultados. Seleccionar un juego no cambia tu biblioteca.`
            : 'Busca un título o elige uno de esta lista.'}
      </p>
      {error ? (
        <p role="alert" className="notice">
          {error}
        </p>
      ) : null}
    </div>
  );
}
