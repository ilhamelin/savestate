'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ActionButton, MutationForm } from '@/components/ui/form';
import { api } from '@/lib/client-api';
import { readJsonResponse } from '@/lib/api-response';
import { REACTIONS, type Reaction } from '@/domain/model';
import type { PostComment } from '@/domain/highlights';
import { soundFx } from '@/lib/sound';
type Comment = PostComment & { username: string };
const labels: Record<Reaction, string> = {
  critical_hit: 'Critical Hit',
  gg: 'GG',
  game_over: 'Game Over',
};
export function PostActions({
  postId,
  viewerId,
  ownerId,
  counts,
  selected,
}: {
  postId: string;
  viewerId: string | null;
  ownerId: string;
  counts: Record<string, number>;
  selected: Reaction | null;
}) {
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(1),
    [comments, setComments] = useState<Comment[]>([]),
    [total, setTotal] = useState(0),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/highlights?post=${postId}&page=${page}`, {
          signal: controller.signal,
        });
        const result = await readJsonResponse<{ comments: Comment[]; total: number }>(response);
        if (!controller.signal.aborted) {
          setComments(result.comments);
          setTotal(result.total);
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : 'No se pudieron leer comentarios.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [postId, page, open, revision]);
  return (
    <>
      <div className="highlight-actions">
        {REACTIONS.map((type) =>
          viewerId ? (
            <span key={type} className={selected === type ? 'selected-reaction' : ''}>
              <ActionButton
                action={async () => {
                  await api('highlights', {
                    action: 'reaction',
                    post_id: postId,
                    reaction_type: type,
                  });
                  if (selected !== type && type === 'critical_hit') soundFx.criticalHit();
                }}
              >
                {labels[type]} · {counts[type] ?? 0}
                {selected === type ? ' ✓' : ''}
              </ActionButton>
            </span>
          ) : (
            <span className="tag" key={type}>
              {labels[type]} · {counts[type] ?? 0}
            </span>
          ),
        )}
        <button
          type="button"
          className="button secondary small"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          Comentarios
        </button>
        {viewerId === ownerId ? (
          <ActionButton
            danger
            action={() => api('highlights', { action: 'delete', post_id: postId })}
          >
            Eliminar momento
          </ActionButton>
        ) : null}
      </div>
      {open ? (
        <section className="highlight-comments" aria-label="Comentarios del momento">
          {loading ? <p role="status">Cargando comentarios…</p> : null}
          {error ? (
            <p role="alert" className="error-text">
              {error}
            </p>
          ) : null}
          {!loading && !comments.length && !error ? (
            <p className="muted">Aún no hay comentarios.</p>
          ) : null}
          {comments.map((comment) => (
            <article key={comment.id} className="panel">
              <Link className="accent" href={`/players/${comment.username}`}>
                @{comment.username}
              </Link>
              <p className="highlight-comment-text">{comment.content}</p>
              <small>{new Date(comment.created_at).toISOString().slice(0, 10)}</small>
              {comment.user_id === viewerId ? (
                <ActionButton
                  danger
                  action={async () => {
                    await api('highlights', {
                      action: 'delete_comment',
                      post_id: postId,
                      comment_id: comment.id,
                    });
                    setRevision((value) => value + 1);
                  }}
                >
                  Eliminar comentario
                </ActionButton>
              ) : null}
            </article>
          ))}
          <div className="highlight-carousel">
            {page > 1 ? (
              <button
                className="button secondary small"
                type="button"
                onClick={() => setPage((value) => value - 1)}
              >
                Anteriores
              </button>
            ) : null}
            {page * 20 < total ? (
              <button
                className="button secondary small"
                type="button"
                onClick={() => setPage((value) => value + 1)}
              >
                Más comentarios
              </button>
            ) : null}
          </div>
          {viewerId ? (
            <MutationForm
              key={revision}
              label="Comentar"
              submit={async (form) => {
                await api('highlights', {
                  action: 'comment',
                  post_id: postId,
                  content: String(form.get('content')),
                });
                setPage(Math.floor(total / 20) + 1);
                setRevision((value) => value + 1);
              }}
            >
              <label>
                Tu comentario
                <textarea name="content" required maxLength={2000} rows={3} />
              </label>
            </MutationForm>
          ) : (
            <Link
              className="accent"
              href={'/login?next=' + encodeURIComponent('/tavern?tab=momentos&post=' + postId)}
            >
              Inicia sesión para comentar o reaccionar.
            </Link>
          )}
        </section>
      ) : null}
    </>
  );
}
