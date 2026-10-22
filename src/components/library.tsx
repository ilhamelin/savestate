'use client';
import { useState } from 'react';
import Link from 'next/link';
import { LibraryEmptyHero } from '@/components/library-empty-hero';
import { GameCard } from '@/components/game-card';
import { achievementPercent, filterLibrary, type LibrarySort } from '@/domain/library-view';
import { libraryPlatformOptions } from '@/domain/library-platforms';
import { QuickHoursEditor } from '@/components/quick-hours-editor';
import { ConsoleProgressBadge } from '@/components/console-progress-badge';
import { SteamAchievementsSync } from '@/components/steam-achievements-sync';
import { steamLogAppId } from '@/domain/steam-achievements';
import { LibraryRecordActions } from '@/components/library-record-actions';
import { LibraryTable } from '@/components/library-table';
import { useLibraryViewPreference } from '@/components/library-view-preference';
import {
  GAME_STATUSES,
  STATUS_LABELS,
  type Game,
  type UserGame,
  type PlayLog,
} from '@/domain/model';
const PAGE_SIZE = 5;
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
  const [view, selectView] = useLibraryViewPreference();
  const [completedAchievements, setCompletedAchievements] = useState(false);
  const [page, setPage] = useState(0);
  if (entries.length === 0) {
    return editable ? <LibraryEmptyHero /> : (
      <section className="empty-state">
        <p>Esta biblioteca aún no tiene juegos registrados.</p>
      </section>
    );
  }
  const gameMap = new Map(games.map((game) => [game.id, game]));
  const gameIds = new Set(entries.map((entry) => entry.game_id));
  const choices = games.filter((game) => gameIds.has(game.id));
  const platforms = libraryPlatformOptions(entries, games, logs);
  const genres = [
    ...new Set(choices.flatMap((game) => game.genres).filter((value) => value?.trim())),
  ].sort((a, b) => a.localeCompare(b, 'es'));
  const visible = filterLibrary(entries, games, logs, {
    query,
    platform,
    genre,
    status: filter,
    sort,
    completedAchievements,
  });
  const totalPages = Math.ceil(visible.length / PAGE_SIZE) || 1;
  const currentPage = Math.min(page, totalPages - 1);
  const pagedVisible = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const fullAchievementEntries = new Set(
    logs.filter((log) => achievementPercent(log) === 100).map((log) => log.user_game_id),
  );
  const collectionCards = [
    {
      id: 'playing',
      label: 'Jugando',
      count: entries.filter((entry) => entry.status === 'playing').length,
    },
    {
      id: 'backlog',
      label: 'Backlog',
      count: entries.filter((entry) => entry.status === 'backlog').length,
    },
    {
      id: 'completed',
      label: 'Completados',
      count: entries.filter((entry) => entry.status === 'cleared' || entry.status === 'platinum')
        .length,
    },
    {
      id: 'achievements',
      label: '🏆 100% Platinados',
      count: entries.filter((entry) => fullAchievementEntries.has(entry.id)).length,
    },
  ];
  function reset() {
    setQuery('');
    setPlatform('');
    setGenre('');
    setFilter('all');
    setCompletedAchievements(false);
    setPage(0);
  }
  return (
    <>
      <section className="collection-dashboard" aria-label="Resumen de colección">
        {collectionCards.map((card) => (
          <button
            type="button"
            key={card.id}
            className="collection-dashboard-card"
            aria-pressed={
              card.id === 'achievements'
                ? completedAchievements && filter === 'all'
                : !completedAchievements && filter === card.id
            }
            onClick={() => {
              setQuery('');
              setPlatform('');
              setGenre('');
              setFilter(card.id === 'achievements' ? 'all' : card.id);
              setCompletedAchievements(card.id === 'achievements');
              setPage(0);
            }}
          >
            <span>{card.label}</span>
            <strong>{card.count}</strong>
          </button>
        ))}
      </section>
      <section className="panel form-stack" aria-label="Buscar y organizar biblioteca">
        <label>
          Buscar en esta biblioteca
          <input
            type="search"
            maxLength={100}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Nombre del juego…"
          />
        </label>
        <div className="form-row">
          <label>
            Plataforma jugada
            <select
              value={platform}
              onChange={(event) => {
                setPlatform(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Todas las plataformas</option>
              {platforms.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Género
            <select
              value={genre}
              onChange={(event) => {
                setGenre(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Todos los géneros</option>
              {genres.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Ordenar por
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as LibrarySort);
                setPage(0);
              }}
            >
              <option value="updated">Última actualización</option>
              <option value="title">Título A–Z</option>
              <option value="rating">Mayor puntuación</option>
              <option value="hours">Más horas registradas</option>
              <option value="achievements">Mayor % de logros / trofeos</option>
            </select>
          </label>
        </div>
        <div className="inline-actions">
          <div
            className="inline-actions library-view-switch"
            role="group"
            aria-label="Vista de biblioteca"
          >
            <button
              type="button"
              className="button secondary"
              aria-pressed={view === 'grid'}
              onClick={() => selectView('grid')}
            >
              ⊞ Vitrina
            </button>
            <button
              type="button"
              className="button secondary"
              aria-pressed={view === 'table'}
              onClick={() => selectView('table')}
            >
              ☰ Tabla
            </button>
          </div>
          <button type="button" className="button secondary" onClick={reset}>
            Limpiar filtros
          </button>
        </div>
        <p className="muted" role="status">
          {visible.length} de {entries.length} juegos cargados
        </p>
      </section>
      <div className="filter-buttons">
        <button
          type="button"
          aria-pressed={completedAchievements}
          onClick={() => {
            setCompletedAchievements((value) => !value);
            setPage(0);
          }}
        >
          🏆 100% Platinados
        </button>
        <button
          aria-pressed={filter === 'all'}
          onClick={() => {
            setFilter('all');
            setPage(0);
          }}
        >
          Todos ({entries.length})
        </button>
        {GAME_STATUSES.map((value) => (
          <button
            key={value}
            aria-pressed={filter === value}
            onClick={() => {
              setFilter(value);
              setPage(0);
            }}
          >
            {STATUS_LABELS[value]} ({entries.filter((e) => e.status === value).length})
          </button>
        ))}
      </div>
      {entries.length > 0 && !visible.length ? (
        <div className="empty-state">
          <p>No hay juegos que coincidan con estos filtros.</p>
          <button type="button" className="button secondary" onClick={reset}>
            Limpiar filtros
          </button>
        </div>
      ) : null}
      {view === 'table' ? (
        <LibraryTable entries={pagedVisible} games={games} logs={logs} editable={editable} />
      ) : (
        pagedVisible.map((entry) => {
          const game = gameMap.get(entry.game_id);
          if (!game) return null;
          const playLogs = logs.filter((log) => log.user_game_id === entry.id);
          return (
            <article key={entry.id} className="panel library-item">
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
                  {playLogs.reduce((sum, log) => sum + Number(log.hours_played), 0).toFixed(1)}{' '}
                  horas
                </p>
                {playLogs
                  .filter((log) => log.console_progress)
                  .map((log) => (
                    <ConsoleProgressBadge
                      key={log.id}
                      progress={log.console_progress!}
                      platform={log.platform_played}
                    />
                  ))}
                {editable && playLogs.length > 0 ? <QuickHoursEditor logs={playLogs} /> : null}
                {editable
                  ? playLogs
                      .filter((log) => steamLogAppId(log.platform_played, log.note))
                      .map((log) => (
                        <SteamAchievementsSync
                          key={log.id}
                          id={log.id}
                          hasProgress={log.console_progress?.kind === 'achievements'}
                        />
                      ))
                  : null}
                <LibraryRecordActions
                  entry={entry}
                  game={game}
                  playLogs={playLogs}
                  editable={editable}
                  expanded
                />
              </div>
            </article>
          );
        })
      )}
      {entries.length > 0 ? (
        <div className="filter-buttons" role="group" aria-label="Paginación de biblioteca">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            ← Anterior
          </button>
          <span role="status">
            Página {currentPage + 1} de {totalPages} ({visible.length} títulos)
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Siguiente →
          </button>
        </div>
      ) : null}
    </>
  );
}
