'use client';
import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { resolveCanonicalPlatform } from '@/integrations/igdb/query';
import { GameScreenshotsModal } from '@/components/game-screenshots-modal';
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
    platform: resolveCanonicalPlatform(initial.platform ?? '').raw,
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
  const effectiveYear = /^(19[5-9]\d|20\d\d|2100)$/.test(year.trim()) ? year.trim() : '';
  const [galleryGame, setGalleryGame] = useState<Game | null>(null);
  const [attempt, setAttempt] = useState(0);
  const cacheRef = useRef<Map<string, Result>>(new Map());
  const delayRef = useRef(0);
  const requestRevision = useRef(0);
  const lastAttempt = useRef(attempt);
  function change(key: keyof Omit<typeof filters, 'offset'>, value: string) {
    if (filters[key] === value && offset === 0) return;
    requestRevision.current++;
    const next = { ...filters, [key]: value, offset: 0 };
    const validYear = /^(19[5-9]\d|20\d\d|2100)$/.test(next.year.trim()) ? next.year.trim() : '';
    if (
      key === 'year' &&
      validYear &&
      ((next.sort === 'classics' && Number(validYear) >= 2010) ||
        (next.sort === 'upcoming' && Number(validYear) < new Date().getUTCFullYear()))
    )
      next.sort = 'relevance';
    const { offset: nextOffset, ...query } = next;
    const cached =
      nextOffset === 0 && (!next.year.trim() || validYear)
        ? cacheRef.current.get(new URLSearchParams({ ...query, year: validYear }).toString())
        : undefined;
    delayRef.current = ['q', 'year'].includes(key) ? 300 : 0;
    setError('');
    if (cached) setResult(cached);
    setLoading(next.year.trim() && !validYear ? false : !cached);
    setFilters(next);
  }
  function clearFilters() {
    requestRevision.current++;
    delayRef.current = 0;
    setError('');
    setFilters({
      q: '',
      platform: '',
      genre: '',
      year: '',
      rating: '',
      sort: 'relevance',
      offset: 0,
    });
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
    if (year.trim() && !effectiveYear) {
      const timer = window.setTimeout(() => setLoading(false), 0);
      return () => {
        window.clearTimeout(timer);
        controller.abort();
      };
    }
    const params = new URLSearchParams({ q, platform, genre, year: effectiveYear, rating, sort });
    const key = params.toString();
    window.history.replaceState(null, '', `/explore?${params}`);
    const retry = lastAttempt.current !== attempt;
    lastAttempt.current = attempt;
    if (!offset && !retry && cacheRef.current.has(key)) {
      // Synchronize an external cache hit after cancelled requests or clearing filters.
      setResult(cacheRef.current.get(key)!);
      setError('');
      setLoading(false);
      return () => controller.abort();
    }
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
  }, [q, platform, genre, year, effectiveYear, rating, sort, offset, attempt]);
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
          {q || platform || genre || year || rating || sort !== 'relevance' ? (
            <button
              type="button"
              className="button small outline explore-clear-filters"
              onClick={clearFilters}
            >
              ✕ Limpiar filtros
            </button>
          ) : null}
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
            <select value={platform} onChange={(event) => change('platform', event.target.value)}>
              {[
                ['', 'Todas'],
                ['PC (Microsoft Windows)', 'PC (Windows)'],
                ['PlayStation 5', 'PlayStation 5'],
                ['PlayStation 4', 'PlayStation 4'],
                ['PlayStation 3', 'PlayStation 3'],
                ['PlayStation 2', 'PlayStation 2'],
                ['PlayStation', 'PlayStation (PS1)'],
                ['Nintendo Switch', 'Nintendo Switch'],
                ['Xbox Series X|S', 'Xbox Series X|S'],
                ['Xbox One', 'Xbox One'],
                ['Xbox 360', 'Xbox 360'],
                ['Super Nintendo Entertainment System', 'Super Nintendo (SNES)'],
                ['Nintendo 64', 'Nintendo 64'],
                ['Game Boy Advance', 'Game Boy Advance'],
                ['Mac', 'Mac'],
                ['Linux', 'Linux'],
                ['Android', 'Android'],
                ['iOS', 'iOS'],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
              {platform && !resolveCanonicalPlatform(platform).canonical ? (
                <option value={platform}>{platform}</option>
              ) : null}
            </select>
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
              type="text"
              inputMode="numeric"
              maxLength={4}
              aria-describedby="explore-year-hint"
              placeholder="Todos"
              value={year}
              onChange={(event) => change('year', event.target.value)}
            />
          </label>
          <label>
            Valoración mínima
            <select value={rating} onChange={(event) => change('rating', event.target.value)}>
              <option value="">Cualquiera</option>
              {[5, 6, 7, 8, 9].map((value) => (
                <option value={value} key={value}>
                  {value}+ / 10
                </option>
              ))}
            </select>
          </label>
        </form>
        {year.trim() && !effectiveYear ? (
          <p id="explore-year-hint" className="muted explore-year-hint">
            Completa un año de cuatro cifras entre 1950 y 2100 para buscar.
          </p>
        ) : (
          <span id="explore-year-hint" className="sr-only">
            Año entre 1950 y 2100.
          </span>
        )}
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
              onOpenGallery={setGalleryGame}
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
      <GameScreenshotsModal game={galleryGame} onClose={() => setGalleryGame(null)} />
    </>
  );
}
