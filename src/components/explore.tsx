'use client';
import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { GameCard } from '@/components/game-card';
import type { Game } from '@/domain/model';
import { readJsonResponse } from '@/lib/api-response';
import { QuickAdd } from '@/components/quick-add';
import { CatalogueSkeleton } from '@/components/ui/loading-skeleton';
interface Result {
  games: (Game & {
    community_rating: number | null;
    release_date: string | null;
    days_until_release: number | null;
  })[];
  source: string;
  message: string | null;
  nextOffset: number | null;
}
export function Explore({
  initial = {},
  authenticated = false,
}: {
  initial?: Record<string, string>;
  authenticated?: boolean;
}) {
  const [filters, setFilters] = useState(() => ({
    q: initial.q ?? '',
    platform: initial.platform ?? '',
    genre: initial.genre ?? '',
    year: initial.year ?? '',
    rating: initial.rating ?? '',
    sort:
      initial.sort === 'recent' || initial.sort === 'classics' || initial.sort === 'upcoming'
        ? initial.sort
        : 'relevance',
    offset: 0,
  }));
  const { q, platform, genre, year, rating, sort, offset } = filters;
  const [attempt, setAttempt] = useState(0);
  const cacheRef = useRef<Map<string, Result>>(new Map());
  const delayRef = useRef(0);
  const requestRevision = useRef(0);
  const lastAttempt = useRef(attempt);
  function change(key: keyof Omit<typeof filters, 'offset'>, value: string) {
    if (filters[key] === value && offset === 0) return;
    requestRevision.current++;
    const next = { ...filters, [key]: value, offset: 0 };
    const { offset: nextOffset, ...query } = next;
    const cached =
      nextOffset === 0 ? cacheRef.current.get(new URLSearchParams(query).toString()) : undefined;
    delayRef.current = ['q', 'platform', 'year'].includes(key) ? 300 : 0;
    setError('');
    if (cached) setResult(cached);
    setLoading(!cached);
    setFilters(next);
  }
  const [result, setResult] = useState<Result>({
      games: [],
      source: '',
      message: null,
      nextOffset: null,
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('focus') === 'search')
      input.current?.focus();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const version = requestRevision.current;
    const params = new URLSearchParams({ q, platform, genre, year, rating, sort });
    const key = params.toString();
    window.history.replaceState(null, '', `/explore?${params}`);
    const retry = lastAttempt.current !== attempt;
    lastAttempt.current = attempt;
    // Cache hits are already restored in the input event, avoiding a loading frame.
    if (!offset && !retry && cacheRef.current.has(key)) return () => controller.abort();
    params.set('offset', String(offset));
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/catalogue?${params}`, { signal: controller.signal });
        const data = await readJsonResponse<Result>(response);
        if (!controller.signal.aborted && version === requestRevision.current) {
          if (!offset) {
            cacheRef.current.set(key, data);
            if (cacheRef.current.size > 30)
              cacheRef.current.delete(cacheRef.current.keys().next().value!);
          }
          setResult((previous) => ({
            ...data,
            games: offset
              ? [
                  ...new Map(
                    [...previous.games, ...data.games].map((game) => [game.id, game]),
                  ).values(),
                ]
              : data.games,
          }));
        }
      } catch (error) {
        if (!controller.signal.aborted && version === requestRevision.current) {
          setError(error instanceof Error ? error.message : 'No se pudo cargar el catálogo.');
          if (!offset) setResult({ games: [], source: '', message: null, nextOffset: null });
        }
      } finally {
        if (!controller.signal.aborted && version === requestRevision.current) setLoading(false);
      }
    }, delayRef.current);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, platform, genre, year, rating, sort, offset, attempt]);
  return (
    <>
      <div className="panel">
        <div className="explore-mode-tabs" role="group" aria-label="Modo del catálogo">
          {(
            [
              ['relevance', '🔥 Populares'],
              ['upcoming', '🚀 Próximos Estrenos'],
              ['recent', '⚡ Recientes'],
              ['classics', '🕹️ Clásicos'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`button small${sort === value ? '' : ' outline'}`}
              aria-pressed={sort === value}
              onClick={() => change('sort', value)}
            >
              {label}
            </button>
          ))}
        </div>
        <form className="search-grid" onSubmit={(event) => event.preventDefault()} role="search">
          <label>
            Buscar juego, estudio o saga
            <input
              ref={input}
              type="search"
              placeholder="Tu próxima aventura… (Ctrl + K)"
              value={q}
              onChange={(event) => change('q', event.target.value)}
              maxLength={80}
            />
          </label>
          <label>
            Plataforma
            <input
              value={platform}
              onChange={(event) => change('platform', event.target.value)}
              maxLength={100}
              placeholder="Nombre exacto"
            />
          </label>
          <label>
            Género
            <select value={genre} onChange={(event) => change('genre', event.target.value)}>
              <option value="">Todos</option>
              {[
                'Role-playing (RPG)',
                'Shooter',
                'Platform',
                'Adventure',
                'Puzzle',
                'Strategy',
                'Racing',
                'Fighting',
                'Sport',
                'Indie',
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Año
            <input
              type="number"
              min="1950"
              max="2100"
              placeholder="Todos"
              value={year}
              onChange={(event) => change('year', event.target.value)}
            />
          </label>
          <label>
            Nota comunitaria
            <select value={rating} onChange={(event) => change('rating', event.target.value)}>
              <option value="">Cualquiera</option>
              {[5, 6, 7, 8, 9].map((value) => (
                <option value={value} key={value}>
                  {value}+ / 10
                </option>
              ))}
            </select>
          </label>
          <label>
            Ordenar por
            <select value={sort} onChange={(event) => change('sort', event.target.value)}>
              <option value="relevance">Relevancia / más opiniones en IGDB</option>
              <option value="recent">Lanzamientos recientes</option>
              <option value="upcoming">Próximos lanzamientos (Cuenta regresiva)</option>
              <option value="classics">Clásicos (antes de 2010)</option>
            </select>
          </label>
        </form>
      </div>
      <div role="status" className="muted">
        {loading ? 'Buscando checkpoint…' : `${result.games.length} juegos encontrados`}
      </div>
      {error ? (
        <p role="alert" className="notice">
          {error}
        </p>
      ) : null}
      {result.message ? <p className="notice">{result.message}</p> : null}
      {loading && !result.games.length ? <CatalogueSkeleton /> : null}
      <div className="game-grid" aria-busy={loading}>
        {result.games.map((game) => (
          <article key={game.id}>
            <GameCard
              game={game}
              score={game.community_rating}
              daysUntil={game.days_until_release}
            />
            <QuickAdd gameId={game.id} authenticated={authenticated} />
          </article>
        ))}
      </div>
      {result.nextOffset !== null ? (
        <button
          className="button secondary"
          disabled={loading}
          onClick={() => {
            requestRevision.current++;
            delayRef.current = 0;
            setLoading(true);
            setAttempt((previous) => previous + 1);
            setFilters((previous) => ({ ...previous, offset: result.nextOffset! }));
          }}
        >
          {loading ? 'Cargando…' : 'Cargar más juegos'}
        </button>
      ) : null}
      {!loading && !result.games.length ? (
        <div className="empty-state">
          <Search size={30} />
          <h2>
            {result.source === 'unconfigured'
              ? 'Tu catálogo espera conexión.'
              : 'Sin resultados para esta búsqueda.'}
          </h2>
          <p>
            {result.source === 'unconfigured'
              ? 'Conecta las APIs siguiendo las instrucciones del proyecto.'
              : 'Prueba otro nombre o ajusta los filtros.'}
          </p>
        </div>
      ) : null}
    </>
  );
}
