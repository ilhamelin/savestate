'use client';
import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { GameCard } from '@/components/game-card';
import type { Game } from '@/domain/model';
interface Result {
  games: (Game & { community_rating: number | null })[];
  source: string;
  message: string | null;
}
export function Explore() {
  const [q, setQ] = useState(''),
    [platform, setPlatform] = useState(''),
    [genre, setGenre] = useState(''),
    [year, setYear] = useState(''),
    [rating, setRating] = useState('');
  const [result, setResult] = useState<Result>({ games: [], source: '', message: null }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('focus') === 'search')
      input.current?.focus();
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ q, platform, genre, year, rating });
        const response = await fetch(`/api/catalogue?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Error de catálogo.');
        setResult(data as Result);
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : 'No se pudo cargar el catálogo.');
          setResult({ games: [], source: '', message: null });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, platform, genre, year, rating]);
  return (
    <>
      <div className="panel">
        <form className="search-grid" onSubmit={(event) => event.preventDefault()} role="search">
          <label>
            Buscar juego, estudio o saga
            <input
              ref={input}
              type="search"
              placeholder="Tu próxima aventura… (Ctrl + K)"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              maxLength={80}
            />
          </label>
          <label>
            Plataforma
            <input
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              maxLength={100}
              placeholder="Nombre exacto"
            />
          </label>
          <label>
            Género
            <select value={genre} onChange={(event) => setGenre(event.target.value)}>
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
              onChange={(event) => setYear(event.target.value)}
            />
          </label>
          <label>
            Nota comunitaria
            <select value={rating} onChange={(event) => setRating(event.target.value)}>
              <option value="">Cualquiera</option>
              {[5, 6, 7, 8, 9].map((value) => (
                <option value={value} key={value}>
                  {value}+ / 10
                </option>
              ))}
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
      <div className="game-grid" aria-busy={loading}>
        {result.games.map((game) => (
          <GameCard key={game.id} game={game} score={game.community_rating} />
        ))}
      </div>
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
