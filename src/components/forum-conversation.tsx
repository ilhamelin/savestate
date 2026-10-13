'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/integrations/supabase/browser';
import { api } from '@/lib/client-api';
import {
  FORUM_REACTIONS,
  optimisticForumReaction,
  type ForumReactionType,
  type ForumAuthor,
  type ForumThreadSummary,
  type ForumReplyView,
} from '@/domain/forum';
import { GamerRoom } from './gamer-room';
import { ForumEditor } from './forum-editor';
import { SocialEmbeds } from './social-embeds';
import { notificationAge } from '@/domain/notifications';
function Author({ author }: { author: ForumAuthor | null }) {
  if (!author) return <aside>Jugador</aside>;
  return (
    <aside className="forum-author" data-theme={author.theme_color}>
      <GamerRoom theme={author.room_theme}>
        {author.avatar_url ? (
          <Image
            src={author.avatar_url}
            alt={`Avatar de ${author.username}`}
            width={64}
            height={64}
            unoptimized
          />
        ) : (
          <span className="forum-avatar" aria-hidden="true">
            ▣
          </span>
        )}
        <Link className="accent" href={`/players/${author.username}`}>
          @{author.username}
        </Link>
        <p className="terminal-status">{author.terminal_status || 'Ready to play'}</p>
        <ul aria-label="Medallas del jugador">
          {author.badges.map((name) => (
            <li key={name}>🏅 {name}</li>
          ))}
        </ul>
      </GamerRoom>
    </aside>
  );
}
function CopyLink({ hash = '' }: { hash?: string }) {
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <button
      type="button"
      className="button outline small"
      aria-label={hash ? 'Copiar enlace directo a esta respuesta' : 'Copiar enlace del hilo'}
      onClick={async () => {
        try {
          const url = new URL(window.location.href);
          url.hash = hash;
          await navigator.clipboard.writeText(url.href);
          setStatus('¡Copiado!');
        } catch {
          setStatus('No se pudo copiar');
        }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setStatus(''), 2000);
      }}
    >
      {status || '🔗 Copiar enlace'}
    </button>
  );
}
export function ForumConversation({
  thread,
  html,
  replies,
  viewerId,
  total,
  page = 1,
}: {
  thread: ForumThreadSummary;
  html: string;
  replies: ForumReplyView[];
  viewerId: string | null;
  total: number;
  page?: number;
}) {
  const [content, setContent] = useState(''),
    [quote, setQuote] = useState<ForumReplyView | null>(null),
    [pending, setPending] = useState(false),
    [reactionPending, setReactionPending] = useState<string | null>(null),
    [error, setError] = useState(''),
    [newReplies, setNewReplies] = useState(false),
    [live, setLive] = useState('Conectando…');
  const [optimisticReplies, setOptimisticReplies] = useState<
    Record<string, { base: ForumReplyView; value: ForumReplyView; pending: boolean }>
  >({});
  const [editing, setEditing] = useState<string | null>(null),
    [editDraft, setEditDraft] = useState(''),
    [replyPending, setReplyPending] = useState<string | null>(null);
  const seen = useRef<string | null>(null),
    editor = useRef<HTMLDivElement>(null),
    router = useRouter();
  useEffect(() => {
    if (seen.current !== thread.id) {
      seen.current = thread.id;
      void api('forum', { action: 'view', thread_id: thread.id }).catch(() => {});
    }
    const db = browserClient(),
      channel = db
        .channel('forum:' + thread.id)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'forum_replies',
            filter: 'thread_id=eq.' + thread.id,
          },
          () => setNewReplies(true),
        )
        .subscribe((status) =>
          setLive(
            status === 'SUBSCRIBED'
              ? 'Conectado en vivo'
              : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'
                ? 'Reconectando; puedes actualizar manualmente.'
                : 'Conectando…',
          ),
        );
    return () => {
      void db.removeChannel(channel);
    };
  }, [thread.id]);
  const labels = { like: '+1', gg: 'GG', mind_blown: '🤯', game_over: 'Game Over' },
    now = new Date().toISOString();
  const displayedReplies = replies.map((reply) => {
    const optimistic = optimisticReplies[reply.id];
    return optimistic && (optimistic.pending || optimistic.base === reply)
      ? optimistic.value
      : reply;
  });
  async function react(reply: ForumReplyView, type: ForumReactionType) {
    const base = replies.find((r) => r.id === reply.id)!;
    setReactionPending(reply.id);
    setError('');
    setOptimisticReplies((previous) => ({
      ...previous,
      [reply.id]: { base, value: optimisticForumReaction(reply, type), pending: true },
    }));
    try {
      await api('forum', { action: 'reaction', reply_id: reply.id, reaction_type: type });
      setOptimisticReplies((previous) => ({
        ...previous,
        [reply.id]: { ...previous[reply.id]!, pending: false },
      }));
      router.refresh();
    } catch (err) {
      setOptimisticReplies((previous) => {
        const next = { ...previous };
        delete next[reply.id];
        return next;
      });
      setError(err instanceof Error ? err.message : 'No se pudo reaccionar.');
    } finally {
      setReactionPending(null);
    }
  }
  async function saveEdit(replyId: string) {
    setReplyPending(replyId);
    setError('');
    try {
      await api('forum', { action: 'edit_reply', reply_id: replyId, content: editDraft });
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo editar.');
    } finally {
      setReplyPending(null);
    }
  }
  async function deleteReply(replyId: string) {
    if (!window.confirm('¿Eliminar tu respuesta? Esta acción no se puede deshacer.')) return;
    setReplyPending(replyId);
    setError('');
    try {
      await api('forum', { action: 'delete_reply', reply_id: replyId });
      if (editing === replyId) setEditing(null);
      const lastPage = Math.max(1, Math.ceil((total - 1) / 20));
      if (page > lastPage)
        router.replace('/forum/' + thread.category_id + '/' + thread.id + '?page=' + lastPage);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.');
    } finally {
      setReplyPending(null);
    }
  }
  return (
    <>
      <div className="forum-live">
        <span role="status">{live}</span>
        <button
          className="button outline small"
          type="button"
          onClick={() => {
            setNewReplies(false);
            router.refresh();
          }}
        >
          {newReplies ? 'Hay nuevas respuestas · Mostrar' : 'Actualizar conversación'}
        </button>
      </div>
      <article id="thread-op" className="panel forum-message forum-message-op">
        <Author author={thread.author} />
        <div className="forum-message-body">
          <div className="forum-post-meta">
            <span className="tag forum-op-badge">👑 AUTOR DEL HILO (OP)</span>
            <time
              dateTime={thread.created_at}
              title={new Date(thread.created_at).toLocaleString('es-CL', {
                timeZone: 'America/Santiago',
              })}
            >
              {notificationAge(thread.created_at, now)}
            </time>
            <CopyLink />
          </div>
          <div className="review-body" dangerouslySetInnerHTML={{ __html: html }} />
          <SocialEmbeds content={thread.content} />
        </div>
      </article>
      {displayedReplies.map((reply, index) => (
        <article id={'reply-' + reply.id} key={reply.id} className="panel forum-message">
          <Author author={reply.author} />
          <div className="forum-message-body">
            <div className="forum-post-meta">
              <span>#{(page - 1) * 20 + index + 1}</span>
              <time
                dateTime={reply.created_at}
                title={new Date(reply.created_at).toLocaleString('es-CL', {
                  timeZone: 'America/Santiago',
                })}
              >
                {notificationAge(reply.created_at, now)}
              </time>
              {reply.updated_at !== reply.created_at ? <span>· editado</span> : null}
              {reply.user_id === thread.user_id ? (
                <span className="tag forum-op-badge">👑 OP</span>
              ) : null}
              <CopyLink hash={'reply-' + reply.id} />
            </div>
            {reply.quote ? (
              <blockquote>
                Cita de @{reply.quote.username}:
                {reply.reply_to_id ? (
                  <a className="forum-quote-link" href={'#reply-' + reply.reply_to_id}>
                    ↑ Ir al mensaje citado
                  </a>
                ) : null}
                <div
                  className="review-body"
                  dangerouslySetInnerHTML={{ __html: reply.quote.html }}
                />
              </blockquote>
            ) : null}
            {editing === reply.id ? (
              <div className="forum-inline-edit">
                <ForumEditor value={editDraft} onChange={setEditDraft} />
                <div className="filter-buttons">
                  <button
                    type="button"
                    className="button small"
                    disabled={replyPending !== null || !editDraft.trim()}
                    onClick={() => void saveEdit(reply.id)}
                  >
                    {replyPending === reply.id ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  <button
                    type="button"
                    className="button outline small"
                    disabled={replyPending !== null}
                    onClick={() => setEditing(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="review-body" dangerouslySetInnerHTML={{ __html: reply.html }} />
                <SocialEmbeds content={reply.content} />
              </>
            )}
            <div className="tags forum-reply-actions">
              {FORUM_REACTIONS.map((type) => (
                <button
                  key={type}
                  className="button outline small"
                  type="button"
                  aria-label={labels[type] + ': ' + reply.counts[type] + ' reacciones'}
                  aria-pressed={reply.ownReaction === type}
                  disabled={!viewerId || reactionPending !== null}
                  onClick={() => void react(reply, type)}
                >
                  {labels[type]} {reply.counts[type]}
                </button>
              ))}
              {viewerId && !thread.is_locked ? (
                <button
                  type="button"
                  className="button outline small"
                  onClick={() => {
                    setQuote(reply);
                    editor.current?.scrollIntoView({
                      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                        ? 'auto'
                        : 'smooth',
                    });
                  }}
                >
                  Citar
                </button>
              ) : null}
              {viewerId === reply.user_id && !thread.is_locked ? (
                <>
                  <button
                    type="button"
                    className="button outline small"
                    disabled={replyPending !== null}
                    onClick={() => {
                      setEditing(reply.id);
                      setEditDraft(reply.content);
                      setError('');
                    }}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    className="button outline small"
                    disabled={replyPending !== null}
                    onClick={() => void deleteReply(reply.id)}
                  >
                    🗑️ Eliminar
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </article>
      ))}
      <div ref={editor} className="panel forum-reply-editor">
        {thread.is_locked ? (
          <p>🔒 Hilo cerrado: no admite nuevas respuestas.</p>
        ) : viewerId ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (pending) return;
              setPending(true);
              setError('');
              try {
                await api('forum', {
                  action: 'reply',
                  thread_id: thread.id,
                  reply_to_id: quote?.id ?? null,
                  content,
                });
                setContent('');
                setQuote(null);
                setNewReplies(false);
                router.replace(
                  `/forum/${thread.category_id}/${thread.id}?page=${Math.ceil((total + 1) / 20)}`,
                );
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo responder.');
              } finally {
                setPending(false);
              }
            }}
          >
            <h2>Tu siguiente mensaje.</h2>
            {quote ? (
              <p>
                Respondiendo a @{quote.author?.username ?? 'jugador'}{' '}
                <button
                  type="button"
                  className="button outline small"
                  onClick={() => setQuote(null)}
                >
                  Cancelar cita
                </button>
              </p>
            ) : null}
            <ForumEditor value={content} onChange={setContent} />
            <button className="button" disabled={pending || !content.trim()}>
              {pending ? 'Enviando…' : 'Publicar respuesta'}
            </button>
          </form>
        ) : (
          <Link
            className="accent"
            href={`/login?next=${encodeURIComponent(`/forum/${thread.category_id}/${thread.id}`)}`}
          >
            Conecta para responder y reaccionar.
          </Link>
        )}
        {error ? (
          <p role="alert" className="error-text">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}
