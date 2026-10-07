'use client';
import { MutationForm, ActionButton } from '@/components/ui/form';
import { api } from '@/lib/client-api';
import { REACTIONS, type ReviewReaction, type ReviewComment } from '@/domain/model';
import Link from 'next/link';
export function SuggestGame() {
  return (
    <details className="panel">
      <summary>¿Falta un juego retro o un hack? Sugerir título</summary>
      <MutationForm
        label="Enviar sugerencia"
        submit={(form) =>
          api('community', {
            action: 'suggest',
            title: String(form.get('title')),
            details: String(form.get('details')),
          })
        }
      >
        <label>
          Título
          <input name="title" required maxLength={200} />
        </label>
        <label>
          Detalles y referencia
          <textarea name="details" required maxLength={2000} />
        </label>
        <p className="muted">
          La sugerencia queda pendiente de revisión. No modifica el catálogo automáticamente.
        </p>
      </MutationForm>
    </details>
  );
}
const labels = { critical_hit: '⚡ Critical Hit', gg: 'GG', game_over: 'Game Over' };
export function ReviewActions({
  id,
  userId,
  reactions,
  comments,
  names,
}: {
  id: string;
  userId: string | null;
  reactions: ReviewReaction[];
  comments: ReviewComment[];
  names: Record<string, string>;
}) {
  const selected = reactions.find((r) => r.user_id === userId)?.reaction_type;
  return (
    <>
      <div className="inline-actions" style={{ marginTop: 20 }}>
        {REACTIONS.map((value) =>
          userId ? (
            <ActionButton
              key={value}
              action={() =>
                api('community', {
                  action: selected === value ? 'unreact' : 'reaction',
                  review_id: id,
                  reaction_type: value,
                })
              }
            >
              {labels[value]} {reactions.filter((r) => r.reaction_type === value).length}
              {selected === value ? ' ✓' : ''}
            </ActionButton>
          ) : (
            <span className="tag" key={value}>
              {labels[value]} {reactions.filter((r) => r.reaction_type === value).length}
            </span>
          ),
        )}
      </div>
      <details style={{ marginTop: 20 }}>
        <summary>Comentarios ({comments.length})</summary>
        {comments.map((comment) => (
          <div className="log-entry" key={comment.id}>
            <Link className="accent" href={`/players/${names[comment.user_id] ?? ''}`}>
              {names[comment.user_id] ?? 'Jugador'}
            </Link>
            <p style={{ whiteSpace: 'pre-wrap' }}>{comment.content}</p>
            {comment.user_id === userId ? (
              <ActionButton
                danger
                action={() => api('community', { action: 'delete_comment', id: comment.id })}
              >
                Eliminar comentario
              </ActionButton>
            ) : null}
          </div>
        ))}
        {userId ? (
          <MutationForm
            label="Comentar"
            submit={(form) =>
              api('community', {
                action: 'comment',
                review_id: id,
                content: String(form.get('comment')),
              })
            }
          >
            <label>
              Comentario
              <textarea name="comment" required maxLength={2000} />
            </label>
          </MutationForm>
        ) : (
          <Link className="accent" href="/login">
            Inicia sesión para comentar.
          </Link>
        )}
      </details>
      {userId ? (
        <details style={{ marginTop: 15 }}>
          <summary>Reportar reseña o spoilers</summary>
          <MutationForm
            label="Enviar reporte"
            submit={(form) =>
              api('community', {
                action: 'report',
                review_id: id,
                reason: String(form.get('reason')),
              })
            }
          >
            <label>
              Motivo
              <textarea name="reason" required maxLength={1000} />
            </label>
          </MutationForm>
        </details>
      ) : null}
    </>
  );
}
