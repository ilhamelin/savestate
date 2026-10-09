'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client-api';
import {
  CONSOLE_PLATFORMS,
  consoleIdentity,
  type ConsoleRow,
  type ConsoleSource,
} from '@/domain/console-import';
import { GAME_STATUSES, STATUS_LABELS, type GameStatus } from '@/domain/model';

type Candidate = {
  id: string;
  title: string;
  cover_url: string | null;
  release_year: number | null;
  platforms: string[];
};
type Row = ConsoleRow & {
  selected: boolean;
  choices: Candidate[];
  gameId: string;
  result: string;
  done: boolean;
};
export function ConsoleImporter({
  source,
  initialIdentity,
}: {
  source: ConsoleSource;
  initialIdentity: string | null;
}) {
  const [identity, setIdentity] = useState(initialIdentity ?? '');
  const [platform, setPlatform] = useState<string>(
    source === 'PlayStation' ? 'PlayStation 5' : 'Xbox Series X|S',
  );
  const [format, setFormat] = useState('text'),
    [content, setContent] = useState('');
  const [rows, setRows] = useState<Row[]>([]),
    [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const alive = useRef(true),
    running = useRef(false),
    cancelled = useRef(false);
  const router = useRouter(),
    id = useId();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancelled.current = true;
    };
  }, []);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);
  function update(index: number, changes: Partial<Row>) {
    setRows((previous) => previous.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }
  async function perform(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    cancelled.current = false;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error ? failure.message : 'No se pudo completar la importación.',
        );
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function loadFile(file: File | undefined) {
    if (!file) return;
    await perform(async () => {
      if (file.size > 200000) throw new Error('El archivo debe ocupar como máximo 200 KB.');
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension !== 'csv' && extension !== 'json')
        throw new Error('Selecciona un archivo CSV o JSON.');
      const raw = await file.text();
      if (!alive.current) return;
      setFormat(extension);
      setContent(raw);
      setRows([]);
      setPage(0);
      setProgress(0);
      setProgressTotal(0);
      setMessage(`Archivo ${file.name} cargado. Previsualiza antes de importar.`);
    });
  }
  async function syncProfile() {
    await perform(async () => {
      const trimmed = consoleIdentity(identity);
      if (!trimmed) {
        throw new Error(
          source === 'PlayStation' ? 'Ingresa tu PSN Online ID.' : 'Ingresa tu Xbox Gamertag.',
        );
      }
      setMessage(`Buscando juegos en el perfil de ${source} para "${trimmed}"…`);
      const preview = await api<ConsoleRow[]>('consoles/import', {
        action: 'sync',
        source,
        identity: trimmed,
      });
      if (!alive.current) return;
      setRows(
        preview.map((row) => ({
          ...row,
          selected: true,
          choices: [],
          gameId: '',
          result: '',
          done: false,
        })),
      );
      setPage(0);
      setProgress(0);
      setProgressTotal(0);
      setMessage(
        `Encontramos ${preview.length} títulos en tu perfil de ${source}. Confirma las coincidencias antes de importar. Se muestran hasta 200 títulos públicos; las horas no están disponibles y quedan en cero.`,
      );
      router.refresh();
    });
  }
  const pending = rows.filter((row) => row.selected && row.gameId && !row.done);
  return (
    <section className="panel console-importer" aria-label={`Importar ${source}`}>
      <h2>{source === 'PlayStation' ? 'PlayStation / PSN' : 'Xbox'}</h2>
      <p className="muted">
        Ingresa tu identificador público para sincronizar automáticamente tus juegos y trofeos, o
        utiliza las opciones manuales más abajo. Tu identificador se guarda en el perfil público; el
        acceso depende de la privacidad del proveedor y de la configuración del servidor.
      </p>
      <fieldset disabled={busy}>
        <div className="form-row">
          <label>
            {source === 'PlayStation' ? 'PSN Online ID (público)' : 'Xbox Gamertag (público)'}
            <input
              minLength={3}
              maxLength={30}
              placeholder={source === 'PlayStation' ? 'Ej: Cristian13' : 'Ej: MasterChief'}
              value={identity}
              onChange={(event) => setIdentity(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void syncProfile();
                }
              }}
            />
          </label>
          <div className="console-sync-actions">
            <button type="button" className="button" onClick={() => void syncProfile()}>
              {source === 'PlayStation' ? '🔍 Sincronizar desde PSN' : '🔍 Sincronizar desde Xbox'}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                void perform(async () => {
                  await api('consoles/import', { action: 'identity', source, identity });
                  if (alive.current) {
                    setMessage('Identificador guardado en tu perfil.');
                    router.refresh();
                  }
                })
              }
            >
              Guardar identificador
            </button>
          </div>
        </div>

        <details className="console-manual-options">
          <summary>Opciones manuales: subir archivo o pegar lista de títulos</summary>
          <div className="form-row">
            <label>
              Plataforma si el archivo no la indica
              <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
                {CONSOLE_PLATFORMS[source].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Archivo de exportación
              <input
                type="file"
                accept=".csv,.json"
                onChange={(event) => {
                  void loadFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
          <label>
            Formato
            <select
              value={format}
              onChange={(event) => {
                setFormat(event.target.value);
                setRows([]);
              }}
            >
              <option value="text">Lista: un título por línea</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <label>
            Contenido
            <textarea
              rows={5}
              maxLength={200000}
              value={content}
              placeholder={'Chrono Trigger\nHalo'}
              onChange={(event) => {
                setContent(event.target.value);
                setRows([]);
              }}
            />
          </label>
          <details>
            <summary>Formatos admitidos y ejemplo</summary>
            <p>
              Hasta 200 juegos y 200 KB. CSV con encabezados title, platform, hours y status (los
              tres últimos son opcionales). Se admiten name/título, plataforma y horas. JSON: array
              de objetos o {`{ "games": [...] }`}. Las horas son decimales; minutes se interpreta
              como minutos. Sin estado explícito se sugiere Playing si hay horas y Backlog en caso
              contrario.
            </p>
            <pre>{'title,platform,hours,status\n"Final Fantasy VII",PS5,12.5,playing'}</pre>
          </details>
          <button
            type="button"
            className="button secondary"
            disabled={!content.trim()}
            style={{ marginTop: '0.5rem' }}
            onClick={() =>
              void perform(async () => {
                const preview = await api<ConsoleRow[]>('consoles/import', {
                  action: 'preview',
                  source,
                  platform,
                  format,
                  content,
                });
                if (!alive.current) return;
                setRows(
                  preview.map((row) => ({
                    ...row,
                    selected: true,
                    choices: [],
                    gameId: '',
                    result: '',
                    done: false,
                  })),
                );
                setPage(0);
                setProgress(0);
                setProgressTotal(0);
                setMessage(
                  `Encontramos ${preview.length} títulos. Busca y confirma cada coincidencia antes de importar.`,
                );
              })
            }
          >
            Previsualizar lista manual
          </button>
        </details>
      </fieldset>
      <p role="status" aria-live="polite">
        {busy ? 'Procesando…' : message}
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {rows.length ? (
        <>
          <h3>
            {rows.length} títulos · {pending.length} preparados
          </h3>
          <label className="checkbox-label">
            <input
              type="checkbox"
              disabled={busy}
              checked={rows.every((row) => row.selected || row.done)}
              onChange={(event) =>
                setRows((old) =>
                  old.map((row) => (row.done ? row : { ...row, selected: event.target.checked })),
                )
              }
            />
            Seleccionar todos
          </label>
          {rows.slice(page * 10, page * 10 + 10).map((row, offset) => {
            const index = page * 10 + offset,
              choice = row.choices.find((item) => item.id === row.gameId);
            return (
              <article className="console-import-row" key={index}>
                <fieldset disabled={busy || row.done}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={(event) => update(index, { selected: event.target.checked })}
                    />
                    <strong>{row.title}</strong>
                  </label>
                  <div className="form-row">
                    <label>
                      Estado
                      <select
                        value={row.status}
                        onChange={(event) =>
                          update(index, { status: event.target.value as GameStatus })
                        }
                      >
                        {GAME_STATUSES.map((item) => (
                          <option key={item} value={item}>
                            {STATUS_LABELS[item]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Plataforma
                      <select
                        value={row.platform}
                        onChange={(event) => update(index, { platform: event.target.value })}
                      >
                        {CONSOLE_PLATFORMS[source].map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Horas
                      <input
                        type="number"
                        min={0}
                        max={100000}
                        step="0.01"
                        value={row.hours}
                        onChange={(event) => update(index, { hours: event.target.valueAsNumber })}
                      />
                    </label>
                  </div>
                  <label>
                    Título para buscar
                    <input
                      maxLength={200}
                      value={row.title}
                      onChange={(event) =>
                        update(index, { title: event.target.value, gameId: '', choices: [] })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      void perform(async () => {
                        const found = await api<{ games: Candidate[]; message: string | null }>(
                          'consoles/import',
                          { action: 'match', source, title: row.title },
                        );
                        if (alive.current)
                          update(index, {
                            choices: found.games,
                            gameId: '',
                            result: found.games.length
                              ? (found.message ?? 'Selecciona la edición correcta.')
                              : 'Sin coincidencias. Ajusta el título o consulta Explorar.',
                          });
                      })
                    }
                  >
                    Buscar coincidencias
                  </button>
                  {row.choices.length ? (
                    <label htmlFor={`${id}-${index}`}>
                      Juego del catálogo
                      <select
                        id={`${id}-${index}`}
                        value={row.gameId}
                        onChange={(event) => update(index, { gameId: event.target.value })}
                      >
                        <option value="">Seleccionar edición…</option>
                        {row.choices.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.title} ({item.release_year ?? 'sin fecha'}) ·{' '}
                            {item.platforms.join(' / ')}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {choice ? (
                    <div className="console-match">
                      {choice.cover_url ? (
                        <Image
                          src={choice.cover_url}
                          alt={`Portada de ${choice.title}`}
                          width={60}
                          height={80}
                        />
                      ) : null}
                      <span>
                        {choice.title} · {choice.release_year ?? 'sin fecha'}
                      </span>
                    </div>
                  ) : null}
                </fieldset>
                <p role="status">{row.result}</p>
              </article>
            );
          })}
          <div className="filter-buttons">
            <button
              type="button"
              disabled={busy || page === 0}
              onClick={() => setPage((old) => old - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page + 1} / {Math.ceil(rows.length / 10)}
            </span>
            <button
              type="button"
              disabled={busy || (page + 1) * 10 >= rows.length}
              onClick={() => setPage((old) => old + 1)}
            >
              Siguiente
            </button>
          </div>
          <p className="muted">
            Los seleccionados sin coincidencia confirmada quedan pendientes. Importación atómica por
            juego: un fallo conserva los juegos que ya se guardaron; puedes reintentar sin duplicar
            horas.
          </p>
          <button
            type="button"
            className="button"
            disabled={busy || !pending.length}
            onClick={() =>
              void perform(async () => {
                setProgress(0);
                setProgressTotal(pending.length);
                let completed = 0,
                  failures = 0;
                for (let index = 0; index < rows.length; index++) {
                  const row = rows[index]!;
                  if (!row.selected || !row.gameId || row.done) continue;
                  if (cancelled.current || !alive.current) break;
                  try {
                    const result = await api<{ message: string }>('consoles/import', {
                      action: 'commit',
                      source,
                      game_id: row.gameId,
                      platform: row.platform,
                      hours: row.hours,
                      status: row.status,
                    });
                    if (!alive.current) break;
                    update(index, { done: true, result: result.message });
                  } catch (failure) {
                    failures++;
                    if (alive.current)
                      update(index, {
                        result: failure instanceof Error ? failure.message : 'No se pudo importar.',
                      });
                  }
                  completed++;
                  if (alive.current) setProgress(completed);
                }
                if (alive.current) {
                  setMessage(
                    `${completed - failures} guardados; ${failures} errores.${cancelled.current ? ' Importación detenida.' : ''}`,
                  );
                  router.refresh();
                }
              })
            }
          >
            Importar {pending.length} juegos confirmados
          </button>
          {busy ? (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                cancelled.current = true;
              }}
            >
              Detener tras el juego actual
            </button>
          ) : null}
          {progressTotal > 0 ? (
            <div>
              <progress aria-label="Progreso de importación" value={progress} max={progressTotal} />
              <p role="status">
                {progress} / {progressTotal} juegos procesados
              </p>
            </div>
          ) : null}
          <Link className="text-link" href="/library">
            Volver a mi biblioteca →
          </Link>
        </>
      ) : null}
    </section>
  );
}
