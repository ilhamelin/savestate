'use client';
import Link from 'next/link';
import { QuickSession } from '@/components/quick-session';
import { LibraryForm, PlayLogForm, DeleteLibrary, DeleteLog } from '@/components/library-forms';
import type { Game, UserGame, PlayLog } from '@/domain/model';
export function LibraryRecordActions({
  entry,
  game,
  playLogs,
  editable,
  expanded = false,
}: {
  entry: UserGame;
  game: Game;
  playLogs: PlayLog[];
  editable: boolean;
  expanded?: boolean;
}) {
  return (
    <details className="library-record-details" open={expanded ? true : undefined}>
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
              <PlayLogForm key={`${log.id}-${log.hours_played}`} entryId={entry.id} log={log} />
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
  );
}
