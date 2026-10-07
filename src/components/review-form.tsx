'use client';
import { useState, useSyncExternalStore, useRef, useEffect } from 'react';
import { MutationForm } from '@/components/ui/form';
import { RatingInput } from '@/components/library-forms';
import { api } from '@/lib/client-api';
import type { UserGame, Review } from '@/domain/model';
import { parseReviewDraft, type ReviewDraft } from '@/domain/review-draft';
const draftEvent = 'savestate-review-draft-change';
function subscribe(callback: () => void) {
  window.addEventListener(draftEvent, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(draftEvent, callback);
    window.removeEventListener('storage', callback);
  };
}
export function ReviewForm({
  userId,
  gameId,
  entry,
  review,
}: {
  userId: string;
  gameId: string;
  entry?: UserGame;
  review?: Review;
}) {
  const key = `savestate.review-draft.v1:${userId}:${gameId}`;
  const initial: ReviewDraft = {
    version: 1,
    content: review?.content_markdown ?? '',
    rating: String(entry?.rating ?? ''),
    spoilers: review ? (review.has_spoilers ? 'yes' : 'no') : '',
    revision: review?.updated_at ?? null,
  };
  const [editor, setEditor] = useState(initial);
  const [storageError, setStorageError] = useState('');
  const [preview, setPreview] = useState<string | null>(null),
    [previewError, setPreviewError] = useState(''),
    [previewPending, setPreviewPending] = useState(false);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const draft = parseReviewDraft(raw);
  const recoverable =
    draft &&
    (draft.content !== editor.content ||
      draft.rating !== editor.rating ||
      draft.spoilers !== editor.spoilers);
  function store(value: ReviewDraft | null) {
    try {
      if (value) localStorage.setItem(key, JSON.stringify(value));
      else localStorage.removeItem(key);
      window.dispatchEvent(new Event(draftEvent));
      setStorageError('');
    } catch {
      setStorageError(
        'Este navegador no pudo guardar el borrador. Puedes seguir escribiendo y publicar.',
      );
    }
  }
  function change(value: ReviewDraft) {
    request.current++;
    setPreview(null);
    setPreviewError('');
    setPreviewPending(false);
    setEditor(value);
    store(value);
  }
  return (
    <MutationForm
      label={review ? 'Actualizar reseña' : 'Publicar reseña'}
      submit={async () => {
        await api('library', {
          action: 'review',
          game_id: gameId,
          rating: Number(editor.rating),
          content: editor.content,
          has_spoilers: editor.spoilers === 'yes',
        });
        store(null);
      }}
    >
      {recoverable && draft ? (
        <div className="notice">
          <p>
            {draft.revision !== initial.revision
              ? 'La reseña publicada cambió desde este borrador. Revisa ambas versiones antes de publicar.'
              : 'Hay un borrador local para este juego.'}
          </p>
          <button type="button" className="button secondary" onClick={() => change(draft)}>
            Recuperar borrador
          </button>
        </div>
      ) : null}
      {draft ? (
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            change(initial);
            store(null);
          }}
        >
          Descartar borrador local
        </button>
      ) : null}
      <RatingInput
        required
        selected={editor.rating}
        onChange={(value) => change({ ...editor, rating: value })}
      />
      <label>
        Tu reseña · Markdown
        <textarea
          name="content"
          required
          minLength={1}
          maxLength={10000}
          rows={8}
          value={editor.content}
          onChange={(event) => change({ ...editor, content: event.target.value })}
          placeholder="¿Qué dejó esta aventura en ti? **Negritas**, *cursivas*, listas y citas."
        />
      </label>
      <label>
        ¿Contiene spoilers? · obligatorio
        <select
          name="spoilers"
          required
          value={editor.spoilers}
          onChange={(event) =>
            change({ ...editor, spoilers: event.target.value as ReviewDraft['spoilers'] })
          }
        >
          <option value="" disabled>
            Elige una opción
          </option>
          <option value="no">No contiene spoilers</option>
          <option value="yes">Sí, ocultar por defecto</option>
        </select>
      </label>
      <p className="muted" role="status">
        {storageError ||
          (draft
            ? 'Borrador guardado en este navegador; aún no se ha publicado.'
            : 'Tu borrador se guardará en este navegador al escribir.')}
      </p>
      <button
        type="button"
        className="button secondary"
        disabled={previewPending || !editor.content.trim()}
        onClick={async () => {
          if (preview !== null) {
            setPreview(null);
            return;
          }
          const current = ++request.current;
          setPreviewPending(true);
          setPreviewError('');
          try {
            const html = await api<string>('library', {
              action: 'preview_review',
              content: editor.content,
            });
            if (current === request.current) setPreview(html);
          } catch (error) {
            if (current === request.current)
              setPreviewError(
                error instanceof Error ? error.message : 'No se pudo generar la vista previa.',
              );
          } finally {
            if (current === request.current) setPreviewPending(false);
          }
        }}
      >
        {previewPending
          ? 'Preparando vista previa…'
          : preview !== null
            ? 'Ocultar vista previa'
            : 'Vista previa de Markdown'}
      </button>
      {previewError ? (
        <p role="alert" className="error-text">
          {previewError}
        </p>
      ) : null}
      {preview !== null ? (
        <section aria-label="Vista previa de tu reseña" className="review-preview">
          <p className="eyebrow">
            VISTA PREVIA · SIN PUBLICAR{editor.spoilers === 'yes' ? ' · SPOILERS' : ''}
          </p>
          <div className="review-body" dangerouslySetInnerHTML={{ __html: preview }} />
        </section>
      ) : null}
      <p className="muted">
        La nota se sincroniza con tu biblioteca solo al publicar. La privacidad sigue sus ajustes.
      </p>
    </MutationForm>
  );
}
