'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/integrations/supabase/browser';
import { api } from '@/lib/client-api';
import {
  FORUM_REACTIONS,
  type ForumAuthor,
  type ForumThreadSummary,
  type ForumReplyView,
} from '@/domain/forum';
import { GamerRoom } from './gamer-room';
import { ForumEditor } from './forum-editor';
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
export function ForumConversation({
  thread,
  html,
  replies,
  viewerId,
  total,
}: {
  thread: ForumThreadSummary;
  html: string;
  replies: ForumReplyView[];
  viewerId: string | null;
  total: number;
}) {
  const [content, setContent] = useState(''),
    [quote, setQuote] = useState<ForumReplyView | null>(null),
    [pending, setPending] = useState(false),
    [reactionPending, setReactionPending] = useState<string | null>(null),
    [error, setError] = useState(''),
    [newReplies, setNewReplies] = useState(false),
    [live, setLive] = useState('Conectando…');
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
        .channel(`forum:${thread.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'forum_replies',
            filter: `thread_id=eq.${thread.id}`,
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
  const labels = { like: '+1', gg: 'GG', mind_blown: '🤯', game_over: 'Game Over' };
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
      <article className="panel forum-message">
        <Author author={thread.author} />
        <div className="forum-message-body">
          <p className="muted">Mensaje inicial · {thread.created_at.slice(0, 10)}</p>
          <div className="review-body" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </article>
      {replies.map((reply) => (
        <article id={`reply-${reply.id}`} key={reply.id} className="panel forum-message">
          <Author author={reply.author} />
          <div className="forum-message-body">
            <p className="muted">
              {reply.created_at.slice(0, 16).replace('T', ' ')} UTC
              {reply.updated_at !== reply.created_at ? ' · editado' : ''}
            </p>
            {reply.quote ? (
              <blockquote>
                Cita de @{reply.quote.username}:
                <div
                  className="review-body"
                  dangerouslySetInnerHTML={{ __html: reply.quote.html }}
                />
              </blockquote>
            ) : null}
            <div className="review-body" dangerouslySetInnerHTML={{ __html: reply.html }} />
            <div className="tags">
              {FORUM_REACTIONS.map((type) => (
                <button
                  key={type}
                  className="button outline small"
                  type="button"
                  aria-label={`${labels[type]}: ${reply.counts[type]} reacciones`}
                  aria-pressed={reply.ownReaction === type}
                  disabled={!viewerId || reactionPending !== null}
                  onClick={async () => {
                    setReactionPending(reply.id);
                    setError('');
                    try {
                      await api('forum', {
                        action: 'reaction',
                        reply_id: reply.id,
                        reaction_type: type,
                      });
                      router.refresh();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'No se pudo reaccionar.');
                    } finally {
                      setReactionPending(null);
                    }
                  }}
                >
                  {labels[type]} {reply.counts[type]}
                </button>
              ))}
              {viewerId && !thread.is_locked ? (
                <button
                  className="button secondary small"
                  type="button"
                  onClick={() => {
                    setQuote(reply);
                    editor.current?.scrollIntoView({
                      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                        ? 'instant'
                        : 'smooth',
                    });
                    editor.current?.querySelector('textarea')?.focus();
                  }}
                >
                  Citar / Responder
                </button>
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
