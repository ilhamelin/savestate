'use client';
import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/client-api';
import { readJsonResponse } from '@/lib/api-response';
import { ITCH_STATUSES, itchUpdateAvailable, type ItchTracker } from '@/domain/itch-tracker';

const labels = {
  playing: 'Jugando',
  waiting_update: 'Esperando actualización',
  completed: 'Completado',
  on_hold: 'En pausa',
};
function edits(tracker: ItchTracker) {
  return {
    currentPlayedVersion: tracker.currentPlayedVersion,
    status: tracker.status,
    milestones: tracker.milestones || [],
    privateNotes: tracker.privateNotes,
  };
}
function TrackerCard({
  tracker,
  onChange,
  onRemove,
}: {
  tracker: ItchTracker;
  onChange: (tracker: ItchTracker) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(tracker),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const working = useRef(false);
  const inputId = useId();
  const dirty = JSON.stringify(edits(draft)) !== JSON.stringify(edits(tracker));
  const available = itchUpdateAvailable(draft);
  async function run(action: 'save' | 'check-updates' | 'remove') {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (action === 'remove') {
        await api('tracker/itch', { action, id: tracker.id });
        onRemove();
      } else if (action === 'save') {
        const saved = await api<ItchTracker>('tracker/itch', {
          action,
          id: tracker.id,
          ...edits(draft),
        });
        setDraft(saved);
        onChange(saved);
        setMessage('Checkpoint indie guardado.');
      } else {
        const result = await api<{ tracker: ItchTracker; message: string }>(
          'tracker/itch/check-updates',
          { id: tracker.id },
        );
        setDraft(result.tracker);
        onChange(result.tracker);
        setMessage(result.message);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo completar la operación.');
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  return (
    <article className="panel indie-tracker-card" id={`itch-${tracker.id}`}>
      <div className="indie-tracker-heading">
        {draft.coverImage ? (
          <Image
            src={draft.coverImage}
            width={180}
            height={140}
            alt={`Portada de ${draft.title}`}
            unoptimized
            className="indie-tracker-cover"
          />
        ) : (
          <span className="indie-tracker-cover" aria-hidden="true">
            ▣
          </span>
        )}
        <div>
          <p className="eyebrow">INDIE CHECKPOINT · itch.io</p>
          <h3>{draft.title}</h3>
          <p className="muted">{draft.author}</p>
          <p className={available ? 'indie-update' : 'accent'}>
            {available
              ? '🟡 ¡Nueva actualización disponible!'
              : draft.currentPlayedVersion
                ? '🟢 Al día con el devlog detectado'
                : 'Versión jugada por indicar'}
          </p>
          {draft.devlog ? (
            <p>
              Último devlog: {draft.devlog.title} ·{' '}
              <time dateTime={draft.devlog.publishedAt}>
                {draft.devlog.publishedAt.slice(0, 10)}
              </time>
            </p>
          ) : (
            <p className="muted">Sin devlog disponible.</p>
          )}
          <div className="filter-buttons">
            {draft.devlog ? (
              <a
                href={draft.devlog.url}
                target="_blank"
                rel="noopener noreferrer"
                className="button outline small"
              >
                Ver devlog ↗
              </a>
            ) : null}
            <a
              href={draft.url}
              target="_blank"
              rel="noopener noreferrer"
              className="button outline small"
            >
              Página / Descargar ↗
            </a>
          </div>
        </div>
      </div>
      <fieldset disabled={busy} className="indie-tracker-fields">
        <legend className="sr-only">Checkpoint de {draft.title}</legend>
        <div className="form-row">
          <label>
            Versión que estoy jugando
            <input
              maxLength={80}
              value={draft.currentPlayedVersion}
              placeholder="Ej. 1.8E"
              onChange={(event) => setDraft({ ...draft, currentPlayedVersion: event.target.value })}
            />
          </label>
          <label>
            Estado
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft({ ...draft, status: event.target.value as ItchTracker['status'] })
              }
            >
              {ITCH_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {labels[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {draft.latestDetectedVersion ? (
          <button
            type="button"
            className="button outline small"
            onClick={() =>
              setDraft({ ...draft, currentPlayedVersion: draft.latestDetectedVersion })
            }
          >
            Estoy jugando la última detectada ({draft.latestDetectedVersion})
          </button>
        ) : null}
        <div className={`indie-version-alarm ${available ? 'triggered' : ''}`} role="status">
          <strong className="indie-alarm-badge">
            {available
              ? `🚨 ¡ALARMA DISPARADA: NUEVA VERSIÓN DETECTADA! (${draft.latestDetectedVersion})`
              : '🔔 Alarma de nueva versión: ACTIVA'}
          </strong>
          <p>
            {available
              ? `La actualización detectada es distinta o posterior a tu versión jugada (${draft.currentPlayedVersion}). Puedes revisar la campana de SaveState y descargar la actualización desde la página oficial.`
              : `Al pulsar «Comprobar actualizaciones», SaveState consulta itch.io y compara el último devlog con tu versión jugada (${draft.currentPlayedVersion || 'actual'}). Si detecta un nuevo devlog, crea una alerta en la campana y envía un aviso a Discord si el canal está configurado.`}
          </p>
          <small className="muted">Comprobación manual · sin vigilancia en segundo plano.</small>
        </div>
        <details>
          <summary>Notas privadas de guardado</summary>
          <label className="sr-only" htmlFor={`${inputId}-notes`}>
            Notas privadas
          </label>
          <textarea
            id={`${inputId}-notes`}
            maxLength={5000}
            rows={4}
            value={draft.privateNotes}
            onChange={(event) => setDraft({ ...draft, privateNotes: event.target.value })}
          />
        </details>
      </fieldset>
      <div className="filter-buttons">
        <button
          type="button"
          className="button small"
          disabled={busy || !dirty}
          onClick={() => void run('save')}
        >
          Guardar checkpoint
        </button>
        <button
          type="button"
          className="button outline small"
          disabled={busy || dirty}
          onClick={() => void run('check-updates')}
        >
          ↺ Comprobar actualizaciones
        </button>
        <button
          type="button"
          className="text-link"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`¿Dejar de rastrear ${draft.title} y borrar su checkpoint privado?`))
              void run('remove');
          }}
        >
          Dejar de rastrear
        </button>
      </div>
      {dirty ? (
        <p className="muted">Guarda los cambios antes de comprobar actualizaciones.</p>
      ) : null}
      <p className="muted">
        Último intento: {draft.lastCheckedAt.slice(0, 19).replace('T', ' ')} UTC · comprobaciones
        separadas por 30 segundos.
      </p>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </article>
  );
}
export function ProfileIndieTracker() {
  const [trackers, setTrackers] = useState<ItchTracker[]>([]),
    [url, setUrl] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [adding, setAdding] = useState(false);
  const working = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/tracker/itch', { signal: controller.signal, cache: 'no-store' })
      .then((response) => readJsonResponse<{ trackers: ItchTracker[] }>(response))
      .then((result) => {
        if (!controller.signal.aborted) setTrackers(result.trackers);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'No se pudo cargar el tracker.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  async function add() {
    if (working.current) return;
    working.current = true;
    setAdding(true);
    setError('');
    try {
      const tracker = await api<ItchTracker>('tracker/itch', { action: 'add', url });
      setTrackers((current) => [tracker, ...current]);
      setUrl('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo añadir el juego.');
    } finally {
      working.current = false;
      setAdding(false);
    }
  }
  return (
    <section id="indie-tracker" className="indie-tracker">
      <div className="page-heading">
        <div>
          <p className="eyebrow">INDIE SIGNAL TRACKER</p>
          <h2>Mis checkpoints de itch.io.</h2>
        </div>
      </div>
      <p className="muted">
        Solo tú puedes ver este tracker y sus notas. Un devlog puede ser una noticia, no
        necesariamente una nueva versión. Comprobación manual, sin descarga automática.
      </p>
      <form
        className="form-row"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <label>
          URL del juego
          <input
            type="url"
            required
            maxLength={1000}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Pega una URL de itch.io para rastrear…"
          />
        </label>
        <button className="button" disabled={adding || loading || trackers.length >= 50}>
          {adding ? 'Consultando itch.io…' : 'Añadir juego'}
        </button>
      </form>
      {loading ? <p role="status">Cargando checkpoints indie…</p> : null}
      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}
      {trackers.map((tracker) => (
        <TrackerCard
          key={tracker.id}
          tracker={tracker}
          onChange={(next) =>
            setTrackers((current) => current.map((item) => (item.id === next.id ? next : item)))
          }
          onRemove={() =>
            setTrackers((current) => current.filter((item) => item.id !== tracker.id))
          }
        />
      ))}
    </section>
  );
}
