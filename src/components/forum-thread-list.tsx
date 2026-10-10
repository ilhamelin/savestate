import Link from 'next/link';
import Image from 'next/image';
import { forumChannel, type ForumCategory, type ForumThreadSummary } from '@/domain/forum';
import { notificationAge } from '@/domain/notifications';
import { MessageSquare, Eye } from 'lucide-react';
export function ForumThreadList({
  threads,
  categories = [],
  emptyMessage,
}: {
  threads: ForumThreadSummary[];
  categories?: ForumCategory[];
  emptyMessage?: string;
}) {
  const now = new Date().toISOString();
  return (
    <div className="forum-thread-list">
      {threads.map((thread) => (
        <article className="panel forum-thread-row" key={thread.id}>
          <div>
            <div className="tags">
              <Link
                className="tag thread-category-chip"
                href={`/forum/${thread.category_id}`}
                data-category={forumChannel(thread.category_id)?.theme}
              >
                {categories.find((category) => category.id === thread.category_id)?.name ??
                  forumChannel(thread.category_id)?.name ??
                  'Canal'}
              </Link>
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
              {thread.author ? (
                <Link href={`/players/${encodeURIComponent(thread.author.username)}`}>
                  @{thread.author.username}
                </Link>
              ) : (
                <span>jugador no disponible</span>
              )}{' '}
              · <time dateTime={thread.created_at}>{notificationAge(thread.created_at, now)}</time>
            </p>
            {thread.lastAuthor ? (
              <p className="muted">
                Última respuesta de{' '}
                <Link
                  className="accent"
                  href={`/players/${encodeURIComponent(thread.lastAuthor.username)}`}
                >
                  @{thread.lastAuthor.username}
                </Link>{' '}
                ·{' '}
                <time dateTime={thread.last_reply_at}>
                  {notificationAge(thread.last_reply_at, now)}
                </time>
              </p>
            ) : null}
          </div>
          <div className="thread-metrics-box" aria-label="Interacción del hilo">
            <span className="thread-replies-pill">
              <MessageSquare size={16} aria-hidden="true" /> {thread.replies_count} respuestas
            </span>
            <span className="thread-views-pill">
              <Eye size={16} aria-hidden="true" /> {thread.views_count} lecturas
            </span>
          </div>
        </article>
      ))}
      {!threads.length ? (
        <div className="empty-state">
          {emptyMessage ?? 'Todavía no hay hilos. Abre la conversación.'}
        </div>
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
