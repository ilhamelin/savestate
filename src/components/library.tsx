'use client';
import { useState } from 'react';
import Link from 'next/link';
import { GameCard } from '@/components/game-card';
import { BacklogPicker } from '@/components/backlog-picker';
import { filterLibrary, type LibrarySort } from '@/domain/library-view';
import { QuickSession } from '@/components/quick-session';
import {
  LibraryForm,
  PlayLogForm,
  FavoritesForm,
  DeleteLibrary,
  DeleteLog,
} from '@/components/library-forms';
import {
  GAME_STATUSES,
  STATUS_LABELS,
  type Game,
  type UserGame,
  type PlayLog,
} from '@/domain/model';
export function Library({
  entries,
  games,
  logs,
  editable = false,
}: {
  entries: UserGame[];
  games: Game[];
  logs: PlayLog[];
  editable?: boolean;
}) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState(''),
    [platform, setPlatform] = useState(''),
    [genre, setGenre] = useState('');
  const [sort, setSort] = useState<LibrarySort>('updated');
  const [compact, setCompact] = useState(false);
  const gameMap = new Map(games.map((game) => [game.id, game]));
  const gameIds = new Set(entries.map((entry) => entry.game_id));
  const choices = games.filter((game) => gameIds.has(game.id));
  const platforms = [...new Set(choices.flatMap((game) => game.platforms))].sort();
  const genres = [...new Set(choices.flatMap((game) => game.genres))].sort();
  const visible = filterLibrary(entries, games, logs, {
    query,
    platform,
    genre,
    status: filter,
    sort,
  });
  function reset() {
    setQuery('');
    setPlatform('');
    setGenre('');
    setFilter('all');
  }
  return (
    <>
      {editable ? <BacklogPicker entries={entries} games={games} /> : null}
      {editable ? (
        <details className="panel">
          <summary>Editar mis Top 4 favoritos</summary>
          <FavoritesForm entries={entries} games={games} />
        </details>
      ) : null}
      <section className="panel form-stack" aria-label="Buscar y organizar biblioteca">
        <label>
          Buscar en esta biblioteca
          <input
            type="search"
            maxLength={100}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre del juego…"
          />
        </label>
        <div className="form-row">
          <label>
            Plataforma de catálogo
            <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
              <option value="">Todas las plataformas</option>
              {platforms.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Género
            <select value={genre} onChange={(event) => setGenre(event.target.value)}>
              <option value="">Todos los géneros</option>
              {genres.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Ordenar por
            <select value={sort} onChange={(event) => setSort(event.target.value as LibrarySort)}>
              <option value="updated">Última actualización</option>
              <option value="title">Título A–Z</option>
              <option value="rating">Mayor puntuación</option>
              <option value="hours">Más horas registradas</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <button
            type="button"
            className="button secondary"
            aria-pressed={compact}
            onClick={() => setCompact((value) => !value)}
          >
            {compact ? 'Ver tarjetas' : 'Vista compacta'}
          </button>
          <button type="button" className="button secondary" onClick={reset}>
            Limpiar filtros
          </button>
        </div>
        <p className="muted" role="status">
          {visible.length} de {entries.length} juegos cargados
        </p>
      </section>
      <div className="filter-buttons">
        <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          Todos ({entries.length})
        </button>
        {GAME_STATUSES.map((value) => (
          <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {STATUS_LABELS[value]} ({entries.filter((e) => e.status === value).length})
          </button>
        ))}
      </div>
      {!entries.length ? (
        <div className="empty-state">
          <h2>Tu próxima aventura empieza aquí.</h2>
          <p>Agrega un juego desde su ficha para empezar el diario.</p>
          <Link className="button" href="/explore">
            Explorar catálogo
          </Link>
        </div>
      ) : null}
      {entries.length > 0 && !visible.length ? (
        <div className="empty-state">
          <p>No hay juegos que coincidan con estos filtros.</p>
          <button type="button" className="button secondary" onClick={reset}>
            Limpiar filtros
          </button>
        </div>
      ) : null}
      {visible.map((entry) => {
        const game = gameMap.get(entry.game_id);
        if (!game) return null;
        const playLogs = logs.filter((log) => log.user_game_id === entry.id);
        return (
          <article
            key={entry.id}
            className={`panel library-item${compact ? ' library-compact' : ''}`}
          >
            <GameCard game={game} score={entry.rating} />
            <div>
              <p className="eyebrow">
                {STATUS_LABELS[entry.status]}{' '}
                {entry.favorite_position ? `// TOP ${entry.favorite_position}` : ''}
              </p>
              <h2>
                <Link href={`/games/${game.slug}`}>{game.title}</Link>
              </h2>
              <p className="muted">
                {entry.rating ? `★ ${entry.rating}/10 · ` : ''}
                {playLogs.length} partidas ·{' '}
                {playLogs.reduce((sum, log) => sum + Number(log.hours_played), 0).toFixed(1)} horas
              </p>
              <details className="library-record-details" open={compact ? undefined : true}>
                <summary>Ver partidas y acciones</summary>
                {editable ? (
                  <>
                    <details>
                      <summary>Actualizar estado y puntuación</summary>
                      <LibraryForm key={entry.updated_at} game={game} entry={entry} />
                    </details>
                    <QuickSession logs={playLogs} />
                    <details>
                      <summary>+ Nueva partida / rejugada</summary>
                      <PlayLogForm entryId={entry.id} />
                    </details>
                  </>
                ) : null}
                {playLogs.map((log) => (
                  <div className="log-entry" key={log.id}>
                    <strong>
                      {log.platform_played} ·{' '}
                      {log.play_method === 'emulator'
                        ? 'Emulador'
                        : log.play_method === 'hardware'
                          ? 'Hardware original'
                          : 'Otro'}{' '}
                      · {log.hours_played} h
                    </strong>
                    <p className="muted">
                      {log.start_date ?? 'Sin inicio'} → {log.finish_date ?? 'En curso'}{' '}
                      {log.difficulty ? `· ${log.difficulty}` : ''}
                    </p>
                    {log.note ? <p>{log.note}</p> : null}
                    {editable ? (
                      <details>
                        <summary>Editar esta partida</summary>
                        <PlayLogForm
                          key={`${log.id}-${log.hours_played}`}
                          entryId={entry.id}
                          log={log}
                        />
                        <DeleteLog id={log.id} />
                      </details>
                    ) : null}
                  </div>
                ))}
                {editable ? (
                  <div className="inline-actions" style={{ marginTop: 20 }}>
                    <Link className="button secondary" href={`/games/${game.slug}#write-review`}>
                      Escribir / editar reseña
                    </Link>
                    <DeleteLibrary id={entry.id} />
                  </div>
                ) : null}
              </details>
            </div>
          </article>
        );
      })}
    </>
  );
}
