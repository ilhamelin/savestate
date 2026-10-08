'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Game, UserGame } from '@/domain/model';
import { GameCard } from '@/components/game-card';
import { api } from '@/lib/client-api';
import { readJsonResponse } from '@/lib/api-response';
type Choice = Pick<Game, 'id' | 'title' | 'cover_url'>;
export function Top4SlotSelector({
  favorites,
  editable,
  shelf = false,
}: {
  favorites: { game: Game; entry: UserGame }[];
  editable: boolean;
  shelf?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [slot, setSlot] = useState<number | null>(null);
  const [tab, setTab] = useState<'library' | 'catalogue'>('library');
  const [query, setQuery] = useState('');
  const [games, setGames] = useState<Choice[]>([]);
  const [offset, setOffset] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (slot === null || (tab === 'catalogue' && query.trim().length < 2)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/${tab === 'library' ? 'favorites' : 'catalogue'}?${new URLSearchParams({ q: query, offset: String(offset) })}`,
          { signal: controller.signal },
        );
        const result = await readJsonResponse<{
          games: Choice[];
          nextOffset: number | null;
          message?: string | null;
        }>(response);
        if (controller.signal.aborted) return;
        setGames((previous) =>
          offset
            ? [...new Map([...previous, ...result.games].map((game) => [game.id, game])).values()]
            : result.games,
        );
        setNextOffset(result.nextOffset);
        setNotice(result.message ?? '');
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'No se pudo buscar.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [slot, tab, query, offset, attempt]);
  function reset(nextTab: 'library' | 'catalogue', nextQuery = '') {
    setTab(nextTab);
    setQuery(nextQuery);
    setGames([]);
    setOffset(0);
    setNextOffset(null);
    setError('');
    setNotice('');
    setAttempt((value) => value + 1);
    setLoading(nextTab === 'library' || nextQuery.trim().length >= 2);
  }
  async function assign(gameId: string | null) {
    if (slot === null || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await api('library', { action: 'favorite_slot', slot, game_id: gameId });
      dialog.current?.close();
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo fijar el juego.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return (
    <>
      <div className={`top4-grid ${shelf ? 'retro-shelf' : ''}`}>
        {[1, 2, 3, 4].map((position) => {
          const favorite = favorites.find(({ entry }) => entry.favorite_position === position);
          return (
            <div className="top4-slot" key={position}>
              {favorite ? (
                <GameCard game={favorite.game} score={favorite.entry.rating} />
              ) : editable ? null : (
                <div className="top4-empty" aria-label={`Ranura ${position} vacía`}>
                  Slot {position} · Vacío
                </div>
              )}
              {editable ? (
                <button
                  type="button"
                  className={favorite ? 'button secondary small top4-edit' : 'top4-empty'}
                  aria-haspopup="dialog"
                  onClick={() => {
                    reset('library');
                    setSlot(position);
                    dialog.current?.showModal();
                  }}
                >
                  {favorite ? `Cambiar slot ${position}` : `+ Fijar slot ${position}`}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {editable ? (
        <dialog
          ref={dialog}
          className="top4-dialog"
          aria-labelledby="top4-title"
          onCancel={(event) => {
            if (savingRef.current) event.preventDefault();
          }}
          onClose={() => setSlot(null)}
        >
          <div className="page-heading">
            <h2 id="top4-title">Editar Top 4 · Slot {slot}</h2>
            <button
              type="button"
              className="button secondary small"
              disabled={saving}
              onClick={() => dialog.current?.close()}
            >
              Cerrar
            </button>
          </div>
          <fieldset disabled={saving} className="form-stack">
            <div className="tabs" role="group" aria-label="Fuente de juegos">
              <button
                type="button"
                className="button secondary small"
                aria-pressed={tab === 'library'}
                onClick={() => reset('library')}
              >
                Mis Juegos
              </button>
              <button
                type="button"
                className="button secondary small"
                aria-pressed={tab === 'catalogue'}
                onClick={() => reset('catalogue')}
              >
                Buscar Catálogo
              </button>
            </div>
            <label>
              Buscar {tab === 'library' ? 'en mi biblioteca' : 'en el catálogo'}
              <input
                type="search"
                value={query}
                maxLength={80}
                placeholder="Nombre del juego"
                onChange={(event) => reset(tab, event.target.value)}
              />
            </label>
            <p className="muted">
              {tab === 'library'
                ? 'Incluye tus juegos de Steam. Se conservan estado, nota y partidas.'
                : 'Los juegos nuevos se añaden al backlog. Mínimo 2 letras.'}
            </p>
            <div className="top4-choices" aria-busy={loading}>
              {games.map((game) => (
                <button
                  type="button"
                  className="top4-choice"
                  key={game.id}
                  disabled={loading}
                  onClick={() => void assign(game.id)}
                >
                  {game.cover_url ? (
                    <img src={game.cover_url} alt="" loading="lazy" />
                  ) : (
                    <span aria-hidden="true">▣</span>
                  )}
                  <span>{game.title}</span>
                </button>
              ))}
            </div>
            {nextOffset !== null ? (
              <button
                type="button"
                className="button secondary small"
                disabled={loading}
                onClick={() => {
                  setOffset(nextOffset);
                  setLoading(true);
                }}
              >
                Cargar más juegos
              </button>
            ) : null}
            <p role="status" className="muted">
              {saving
                ? 'Guardando favorito…'
                : loading
                  ? 'Buscando…'
                  : games.length
                    ? `${games.length} juegos`
                    : 'No hay resultados.'}
              {notice ? ` ${notice}` : ''}
            </p>
            <button type="button" className="button secondary" onClick={() => void assign(null)}>
              Desasignar este slot
            </button>
          </fieldset>
          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}
        </dialog>
      ) : null}
    </>
  );
}
