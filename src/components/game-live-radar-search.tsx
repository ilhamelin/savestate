'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '@/lib/client-api';
import type { GameLiveTelemetry } from '@/domain/game-live-telemetry';
import { GameLiveTelemetryView } from '@/components/game-live-telemetry-view';
const quickTitles = [
  'Elden Ring',
  'Counter-Strike 2',
  'Cyberpunk 2077',
  'Hollow Knight',
  "Baldur's Gate 3",
];
export function GameLiveRadarSearch() {
  const [title, setTitle] = useState('');
  const [loadedTitle, setLoadedTitle] = useState('');
  const [data, setData] = useState<GameLiveTelemetry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search(value: string) {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setTitle(value);
    setLoading(true);
    setError('');
    setData(null);
    try {
      const result = await api<GameLiveTelemetry>(
        'tracker/radar',
        { title: value },
        request.signal,
      );
      if (!request.signal.aborted) {
        setData(result);
        setLoadedTitle(value.trim());
      }
    } catch (failure) {
      if (!request.signal.aborted)
        setError(failure instanceof Error ? failure.message : 'No se pudo consultar el radar.');
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void search(title);
  }
  return (
    <div>
      <section className="panel">
        <p className="eyebrow">STEAM // CHEAPSHARK // TWITCH</p>
        <h1>Radar en Vivo</h1>
        <p className="muted">
          Busca un juego para consultar sus jugadores, precios y streams. Datos cacheados cinco
          minutos.
        </p>
        <form className="filter-buttons" onSubmit={submit}>
          <label>
            Título del juego
            <input
              required
              minLength={2}
              maxLength={100}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="¿Qué juego quieres seguir?"
            />
          </label>
          <button className="button" disabled={loading}>
            📡 {loading ? 'Consultando…' : 'Consultar radar'}
          </button>
        </form>
        <div className="filter-buttons" aria-label="Juegos rápidos">
          {quickTitles.map((game) => (
            <button type="button" key={game} onClick={() => void search(game)}>
              {game}
            </button>
          ))}
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </section>
      {loading && (
        <div className="panel skeleton" role="status">
          Buscando jugadores, ofertas y transmisiones…
        </div>
      )}
      {data && <GameLiveTelemetryView data={data} title={loadedTitle} />}
    </div>
  );
}
