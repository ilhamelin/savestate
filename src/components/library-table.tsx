'use client';
import { Fragment, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Game, UserGame, PlayLog } from '@/domain/model';
import { STATUS_LABELS } from '@/domain/model';
import { achievementPercent } from '@/domain/library-view';
import { LibraryRecordActions } from '@/components/library-record-actions';
import { QuickHoursEditor } from '@/components/quick-hours-editor';
import { SteamAchievementsSync } from '@/components/steam-achievements-sync';
import { steamLogAppId } from '@/domain/steam-achievements';

export function LibraryTable({
  entries,
  games,
  logs,
  editable,
}: {
  entries: UserGame[];
  games: Game[];
  logs: PlayLog[];
  editable: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const gameMap = new Map(games.map((game) => [game.id, game]));
  return (
    <div
      className="library-table-scroll"
      role="region"
      aria-label="Biblioteca en tabla"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Allows keyboard scrolling of the wide table.
      tabIndex={0}
    >
      <table className="library-table">
        <caption className="sr-only">Juegos de la biblioteca y su progreso por plataforma</caption>
        <thead>
          <tr>
            {[
              'Juego',
              'Plataforma',
              'Estado',
              'Horas',
              'Logros / Trofeos',
              'Nota personal',
              'Acciones',
            ].map((title) => (
              <th scope="col" key={title}>
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const game = gameMap.get(entry.game_id);
            if (!game) return null;
            const playLogs = logs.filter((log) => log.user_game_id === entry.id);
            const platforms = [
              ...new Set(playLogs.map((log) => log.platform_played).filter(Boolean)),
            ];
            const progressLogs = playLogs.filter((log) => achievementPercent(log) !== null);
            const open = expanded === entry.id;
            return (
              <Fragment key={entry.id}>
                <tr>
                  <th scope="row">
                    <Link className="library-table-game" href={`/games/${game.slug}`}>
                      {game.cover_url ? (
                        <Image src={game.cover_url} alt="" width={32} height={44} />
                      ) : (
                        <span className="library-table-cover" aria-hidden="true">
                          🎮
                        </span>
                      )}
                      <span>
                        {game.title}
                        <small>{game.release_year ?? 'Sin fecha'}</small>
                      </span>
                    </Link>
                  </th>
                  <td>
                    {(platforms.length ? platforms : game.platforms).join(' · ') ||
                      'Sin plataforma'}
                  </td>
                  <td>
                    <span className={`library-status status-${entry.status}`}>
                      {STATUS_LABELS[entry.status]}
                    </span>
                  </td>
                  <td className="library-table-number">
                    {playLogs.reduce((sum, log) => sum + Number(log.hours_played), 0).toFixed(1)} h
                  </td>
                  <td>
                    {progressLogs.length ? (
                      progressLogs.map((log) => {
                        const progress = log.console_progress!;
                        const percent = achievementPercent(log)!;
                        const unit =
                          progress.kind === 'gamerscore'
                            ? 'G'
                            : progress.kind === 'trophies'
                              ? 'trofeos'
                              : 'logros';
                        return (
                          <div className="library-table-progress" key={log.id}>
                            <span>
                              {log.platform_played} · {Math.round(percent)}%
                            </span>
                            <progress
                              value={percent}
                              max={100}
                              aria-label={`${game.title}: progreso en ${log.platform_played}`}
                            />
                            <small>
                              {progress.current} / {progress.total} {unit}
                            </small>
                          </div>
                        );
                      })
                    ) : (
                      <span className="muted">Sin datos</span>
                    )}
                  </td>
                  <td className="library-table-number">
                    {entry.rating !== null ? `★ ${entry.rating} / 10` : 'Sin nota'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="button secondary"
                      aria-expanded={open}
                      aria-controls={`library-actions-${entry.id}`}
                      aria-label={`${open ? 'Cerrar' : 'Ver'} acciones de ${game.title}`}
                      onClick={() => setExpanded(open ? null : entry.id)}
                    >
                      {open ? 'Cerrar' : editable ? 'Acciones' : 'Partidas'}
                    </button>
                  </td>
                </tr>
                <tr
                  id={`library-actions-${entry.id}`}
                  hidden={!open}
                  className="library-table-actions"
                >
                  <td colSpan={7}>
                    {open ? (
                      <>
                        <h3>{game.title}</h3>
                        {editable && playLogs.length ? <QuickHoursEditor logs={playLogs} /> : null}
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
                      </>
                    ) : null}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
