'use client';
import { useState } from 'react';
import Link from 'next/link';
import { GameCard } from '@/components/game-card';
import { BacklogPicker } from '@/components/backlog-picker';
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
  const gameMap = new Map(games.map((game) => [game.id, game]));
  return (
    <>
      {editable ? <BacklogPicker entries={entries} games={games} /> : null}
      {editable ? (
        <details className="panel">
          <summary>Editar mis Top 4 favoritos</summary>
          <FavoritesForm entries={entries} games={games} />
        </details>
      ) : null}
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
      {entries
        .filter((entry) => filter === 'all' || entry.status === filter)
        .map((entry) => {
          const game = gameMap.get(entry.game_id);
          if (!game) return null;
          const playLogs = logs.filter((log) => log.user_game_id === entry.id);
          return (
            <article key={`${entry.id}-${entry.updated_at}`} className="panel library-item">
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
                {editable ? (
                  <>
                    <details>
                      <summary>Actualizar estado y puntuación</summary>
                      <LibraryForm game={game} entry={entry} />
                    </details>
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
                        <PlayLogForm entryId={entry.id} log={log} />
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
              </div>
            </article>
          );
        })}
    </>
  );
}
