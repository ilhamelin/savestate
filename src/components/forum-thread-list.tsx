import Link from 'next/link';
import Image from 'next/image';
import type { ForumThreadSummary } from '@/domain/forum';
export function ForumThreadList({ threads }: { threads: ForumThreadSummary[] }) {
  return (
    <div className="forum-thread-list">
      {threads.map((thread) => (
        <article className="panel forum-thread-row" key={thread.id}>
          <div>
            <div className="tags">
              {thread.is_pinned ? <span className="tag">📌 Fijado</span> : null}
              {thread.is_locked ? <span className="tag">🔒 Cerrado</span> : null}
              {thread.game ? (
                <Link className="tag" href={`/games/${thread.game.slug}`}>
                  {thread.game.title}
                </Link>
              ) : null}
            </div>
            <h3>
              <Link className="accent" href={`/forum/${thread.category_id}/${thread.id}`}>
                {thread.title}
              </Link>
            </h3>
            <p
              className="muted forum-author-mini"
              data-theme={thread.author?.theme_color ?? 'cyan'}
            >
              {thread.author?.avatar_url ? (
                <Image src={thread.author.avatar_url} alt="" width={24} height={24} unoptimized />
              ) : null}
              Por{' '}
              <Link href={`/players/${thread.author?.username ?? ''}`}>
                @{thread.author?.username ?? 'jugador'}
              </Link>{' '}
              · Última actividad{' '}
              {new Date(thread.last_reply_at).toISOString().slice(0, 16).replace('T', ' ')} UTC
            </p>
            {thread.lastAuthor ? (
              <p className="muted">
                Última respuesta de{' '}
                <Link className="accent" href={`/players/${thread.lastAuthor.username}`}>
                  @{thread.lastAuthor.username}
                </Link>
              </p>
            ) : null}
          </div>
          <p>
            {thread.replies_count} respuestas
            <br />
            {thread.views_count} lecturas
          </p>
        </article>
      ))}
      {!threads.length ? (
        <div className="empty-state">Todavía no hay hilos. Abre la conversación.</div>
      ) : null}
    </div>
  );
}
export function ForumPagination({
  page,
  total,
  base,
}: {
  page: number;
  total: number;
  base: string;
}) {
  const join = base.includes('?') ? '&' : '?';
  return (
    <nav className="forum-pagination" aria-label="Paginación del foro">
      {page > 1 ? (
        <Link className="button outline" href={`${base}${join}page=${page - 1}`}>
          ← Anterior
        </Link>
      ) : null}
      <span>
        Página {page} · {total} resultados
      </span>
      {page * 20 < total ? (
        <Link className="button outline" href={`${base}${join}page=${page + 1}`}>
          Siguiente →
        </Link>
      ) : null}
    </nav>
  );
}
