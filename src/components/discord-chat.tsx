'use client';
import Image from 'next/image';
import Link from 'next/link';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  DiscordMessage,
  DiscordOnlineMember,
  DiscordFrequency,
  DiscordMention,
  DiscordMentionTarget,
} from '@/domain/discord-client';
import {
  discordMessageOrigin,
  discordImageAttachment,
  discordInlineMedia,
  sameDiscordMessages,
  discordNearBottom,
  discordMentionTargets,
  discordMentionParts,
  discordMessageMentioned,
  discordHasMention,
} from '@/domain/discord-client';
import { api } from '@/lib/client-api';
import { readJsonResponse } from '@/lib/api-response';
import { DiscordLinkedRoleCard } from '@/components/discord-linked-role-card';
import { DiscordGamePicker } from '@/components/discord-game-picker';
function messageAuthor(message: DiscordMessage) {
  return discordMessageOrigin(message.content).author ?? message.author;
}
function DiscordText({ text, names }: { text: string; names: string[] }) {
  return (
    <>
      {discordMentionParts(text, names).map((part, index) =>
        part.mention ? (
          <span key={index} className="discord-mention-chip">
            {part.text}
          </span>
        ) : (
          <span key={index}>
            {part.text.split(/(https:\/\/[^\s<>]+)/g).map((piece, i) => {
              if (!piece.startsWith('https://')) return piece;
              try {
                const url = new URL(piece.replace(/[).,;!?]+$/, ''));
                if (url.username || url.password || url.port) return piece;
                return (
                  <a key={i} href={url.href} target="_blank" rel="noopener noreferrer">
                    {piece}
                  </a>
                );
              } catch {
                return piece;
              }
            })}
          </span>
        ),
      )}
    </>
  );
}
function formatMessageDate(date: string) {
  const value = new Date(date);
  if (!Number.isFinite(value.getTime())) return 'Fecha no disponible';
  return value.toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
type ActiveMedia = { url: string; alt?: string };
function MediaLightbox({ media, onClose }: { media: ActiveMedia; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="discord-lightbox-overlay"
      aria-label="Visor de imágenes y GIFs"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="discord-lightbox-dialog">
        <div className="filter-buttons">
          <button type="button" className="button outline small" onClick={onClose}>
            ✕ Cerrar
          </button>
          <a
            className="button outline small"
            href={media.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            ↗ Abrir original
          </a>
        </div>
        {failed ? (
          <p role="status">No se pudo cargar el medio. Puedes abrir el original.</p>
        ) : (
          <Image
            className="discord-lightbox-image"
            src={media.url}
            width={1200}
            height={800}
            alt={media.alt ?? 'Imagen o GIF compartido'}
            unoptimized
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </dialog>
  );
}
function InlineMedia({ url, onOpen }: { url: string; onOpen: (media: ActiveMedia) => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <div>
      {!failed ? (
        <button
          type="button"
          className="discord-media-button"
          aria-label="Ampliar imagen o GIF compartido"
          aria-haspopup="dialog"
          onClick={() => onOpen({ url, alt: 'Imagen o GIF compartido' })}
        >
          <Image
            className="discord-inline-media"
            src={url}
            width={360}
            height={240}
            alt="Imagen o GIF compartido"
            unoptimized
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        </button>
      ) : (
        <p className="muted">No se pudo cargar la imagen o el GIF.</p>
      )}
      <a href={url} target="_blank" rel="noopener noreferrer">
        Abrir imagen/GIF original ↗
      </a>
    </div>
  );
}
const DiscordMessageCard = memo(function DiscordMessageCard({
  message,
  onOpen,
  canInteract,
  viewerUsername,
  mentionNames,
  onReply,
  onMention,
}: {
  message: DiscordMessage;
  onOpen: (media: ActiveMedia) => void;
  canInteract: boolean;
  viewerUsername: string | null;
  mentionNames: string[];
  onReply: (message: DiscordMessage) => void;
  onMention: (message: DiscordMessage) => void;
}) {
  const origin = discordMessageOrigin(message.content);
  const media = discordInlineMedia(origin.content);
  return (
    <article
      key={message.id}
      className={`discord-message${discordMessageMentioned(message, viewerUsername) ? ' discord-message-mentioned' : ''}`}
    >
      {message.avatar ? (
        <Image src={message.avatar} width={36} height={36} alt="" unoptimized />
      ) : (
        <span aria-hidden="true">▣</span>
      )}
      <div className="discord-message-bubble">
        {message.replyTo && (
          <p className="discord-reply-reference">
            ↩ @{message.replyTo.author}:{' '}
            {message.replyTo.excerpt
              ? `“${message.replyTo.excerpt}”`
              : 'Mensaje original no disponible'}
          </p>
        )}
        <span className={origin.web ? 'badge-savestate' : 'badge-discord'}>
          {origin.web ? '[SAVESTATE_WEB]' : '[DISCORD]'}
        </span>{' '}
        {origin.web && origin.author ? (
          <Link className="accent" href={`/players/${encodeURIComponent(origin.author)}`}>
            @{origin.author}
          </Link>
        ) : (
          <strong className="accent">{message.author}</strong>
        )}{' '}
        <time dateTime={message.createdAt} title="Hora de Chile · America/Santiago">
          {formatMessageDate(message.createdAt)}
        </time>
        {media.text ? (
          <p>
            <DiscordText text={media.text} names={mentionNames} />
          </p>
        ) : !media.urls.length && !message.attachments.length ? (
          <p>Mensaje sin texto disponible.</p>
        ) : null}
        {media.urls.map((url) => (
          <InlineMedia key={url} url={url} onOpen={onOpen} />
        ))}
        {message.attachments.map((file) => (
          <p key={file.url}>
            {discordImageAttachment(file.url) ? (
              <button
                type="button"
                className="discord-media-button"
                aria-label={`Ampliar ${file.name}`}
                aria-haspopup="dialog"
                onClick={() => onOpen({ url: file.url, alt: file.name })}
              >
                <Image
                  className="discord-attachment-thumb"
                  src={file.url}
                  width={240}
                  height={160}
                  alt={file.name}
                  unoptimized
                />
              </button>
            ) : (
              <a href={file.url} target="_blank" rel="noopener noreferrer">
                ↗ {file.name}
              </a>
            )}
          </p>
        ))}
        {canInteract && (
          <div className="discord-message-actions">
            <button type="button" className="button outline small" onClick={() => onReply(message)}>
              ↩ Responder
            </button>
            {(origin.web || message.authorId) && (
              <button
                type="button"
                className="button outline small"
                onClick={() => onMention(message)}
              >
                @ Mencionar
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
});
export function DiscordChat({ inviteUrl }: { inviteUrl: string | null }) {
  const [node, setNode] = useState<{ online: boolean; latency: number | null }>({
    online: false,
    latency: null,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [activeMedia, setActiveMedia] = useState<ActiveMedia | null>(null);
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [viewerUsername, setViewerUsername] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<DiscordMessage | null>(null);
  const [selectedMentions, setSelectedMentions] = useState<DiscordMention[]>([]);
  const [mentionsOpen, setMentionsOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [caret, setCaret] = useState(0);
  const [gamePicker, setGamePicker] = useState(false);
  const [presence, setPresence] = useState<{ onlineCount: number; members: DiscordOnlineMember[] }>(
    { onlineCount: 0, members: [] },
  );
  const [content, setContent] = useState(''),
    [error, setError] = useState('');
  const targets = useMemo(
    () => discordMentionTargets(messages, presence.members),
    [messages, presence.members],
  );
  const mentionNames = useMemo(
    () => [
      ...targets.map((target) => target.username),
      ...(viewerUsername ? [viewerUsername] : []),
    ],
    [targets, viewerUsername],
  );
  const mentionToken = /(?:^|\s)@([^\s@]*)$/u.exec(content.slice(0, caret));
  const suggestions = targets
    .filter((target) =>
      target.username.toLowerCase().startsWith((mentionToken?.[1] ?? '').toLowerCase()),
    )
    .slice(0, 8);
  const replyMessage = useCallback((message: DiscordMessage) => {
    if (busy.current) return;
    setReplyTo(message);
    inputRef.current?.focus();
  }, []);
  const mentionMessage = useCallback((message: DiscordMessage) => {
    if (busy.current) return;
    const username = messageAuthor(message);
    setContent((current) => {
      const next = `${current}${current && !current.endsWith(' ') ? ' ' : ''}@${username} `;
      return next.length <= 500 ? next : current;
    });
    if (message.authorId)
      setSelectedMentions((current) =>
        [
          ...current.filter((item) => item.id !== message.authorId),
          { id: message.authorId!, username },
        ].slice(-5),
      );
    setMentionsOpen(false);
    inputRef.current?.focus();
  }, []);
  function insertMention(target: DiscordMentionTarget) {
    if (
      target.id &&
      !selectedMentions.some((item) => item.id === target.id) &&
      selectedMentions.length >= 5
    ) {
      setError('Puedes seleccionar hasta 5 menciones de Discord.');
      return;
    }
    const start = mentionToken ? caret - mentionToken[1]!.length - 1 : caret;
    const insert = `@${target.username} `;
    const next = content.slice(0, start) + insert + content.slice(caret);
    if (next.length > 500) {
      setError('La mención supera el límite de 500 caracteres.');
      return;
    }
    setContent(next);
    setCaret(start + insert.length);
    setMentionsOpen(false);
    if (target.id)
      setSelectedMentions((current) => [
        ...current.filter((item) => item.id !== target.id),
        { id: target.id!, username: target.username },
      ]);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(start + insert.length, start + insert.length);
    });
  }
  const [loading, setLoading] = useState(true),
    [sending, setSending] = useState(false);
  const [revision, setRevision] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [frequency, setFrequency] = useState<DiscordFrequency>('web-chat');
  const frequencyRef = useRef<DiscordFrequency>('web-chat');
  const [newMessages, setNewMessages] = useState(false);
  const pendingScroll = useRef(true);
  const messagesRef = useRef<DiscordMessage[]>([]);
  const visibleMessages = messages;
  const lastVisibleId = visibleMessages.at(-1)?.id;
  function scrollToEnd() {
    const list = listRef.current;
    list?.scrollTo({
      top: list.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }
  function selectFrequency(next: DiscordFrequency) {
    if (next === frequency || busy.current) return;
    frequencyRef.current = next;
    pendingScroll.current = true;
    setNewMessages(false);
    messagesRef.current = [];
    setMessages([]);
    setError('');
    setLoading(true);
    setNode({ online: false, latency: null });
    setFrequency(next);
    setReplyTo(null);
    setSelectedMentions([]);
    setMentionsOpen(false);
    setGamePicker(false);
  }
  const cooldownUntil = useRef(0);
  const [cooldown, setCooldown] = useState(0);
  useLayoutEffect(() => {
    if (!pendingScroll.current) return;
    pendingScroll.current = false;
    const list = listRef.current;
    list?.scrollTo({ top: list.scrollHeight, behavior: 'instant' });
  }, [lastVisibleId, frequency]);
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldown(Math.max(0, Math.ceil((cooldownUntil.current - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let controller: AbortController | undefined;
    let disposed = false;
    async function refresh() {
      if (document.visibilityState !== 'visible') return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const started = performance.now();
      try {
        const response = await fetch(`/api/discord/messages?channel=${frequency}`, {
          signal: request.signal,
          cache: 'no-store',
        });
        const data = await readJsonResponse<{
          messages: DiscordMessage[];
          presence: typeof presence;
          viewerUsername: string | null;
        }>(response);
        if (!disposed && !request.signal.aborted && frequencyRef.current === frequency) {
          if (!busy.current && !sameDiscordMessages(messagesRef.current, data.messages)) {
            const previous = messagesRef.current;
            const hasNew = data.messages.some(
              (message) => !previous.some((item) => item.id === message.id),
            );
            const list = listRef.current;
            const nearBottom =
              !list || discordNearBottom(list.scrollTop, list.clientHeight, list.scrollHeight);
            if (hasNew) {
              pendingScroll.current = !previous.length || nearBottom;
              if (previous.length && !nearBottom) setNewMessages(true);
            }
            messagesRef.current = data.messages;
            setMessages(data.messages);
          }
          setPresence((current) =>
            JSON.stringify(current) === JSON.stringify(data.presence) ? current : data.presence,
          );
          setViewerUsername(data.viewerUsername ?? null);
          setError('');
          setNode({ online: true, latency: Math.round(performance.now() - started) });
        }
      } catch (failure) {
        if (!disposed && !request.signal.aborted && frequencyRef.current === frequency) {
          setNode({ online: false, latency: null });
          setPresence({ onlineCount: 0, members: [] });
          setError(failure instanceof Error ? failure.message : 'No se pudo leer Discord.');
        }
      } finally {
        if (!disposed && !request.signal.aborted && frequencyRef.current === frequency)
          setLoading(false);
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [revision, frequency]);
  async function send() {
    if (
      frequency !== 'web-chat' ||
      busy.current ||
      Date.now() < cooldownUntil.current ||
      !content.trim()
    )
      return;
    busy.current = true;
    setSending(true);
    setError('');
    cooldownUntil.current = Date.now() + 3000;
    setCooldown(3);
    try {
      const result = await api<{ message: DiscordMessage | null }>('discord/messages', {
        content,
        channel: 'web-chat',
        replyToMessageId: replyTo?.id,
        mentions: selectedMentions.filter((mention) =>
          discordHasMention(content, mention.username),
        ),
      });
      if (result.message) {
        const next = [
          ...messagesRef.current.filter((message) => message.id !== result.message!.id),
          result.message,
        ].slice(-30);
        pendingScroll.current = true;
        setNewMessages(false);
        messagesRef.current = next;
        setMessages(next);
      }
      setContent('');
      setReplyTo(null);
      setSelectedMentions([]);
      setMentionsOpen(false);
      cooldownUntil.current = Date.now() + 3000;
      setCooldown(3);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo enviar el mensaje.');
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  return (
    <div className="discord-layout-grid">
      <section className="panel discord-chat">
        <div className="discord-terminal-bar">
          <span className="discord-terminal-leds" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>TERMINAL://RELAY_DISCORD_V1.0</span>
        </div>
        <div className="discord-chat-heading">
          <h2>Discord Bridge · Terminal comunitaria</h2>
          <span className="discord-live" role="status">
            <span className={node.online ? 'live-pulse' : ''} aria-hidden="true">
              {node.online ? '🟢' : '◌'}
            </span>{' '}
            {loading ? 'CONECTANDO' : node.online ? 'LIVE SYNC' : 'SYNC EN PAUSA'} // #
            {frequency === 'announcements' ? 'anuncios-savestate' : frequency}
          </span>
          <button
            type="button"
            className="button outline small"
            onClick={() => setRevision((n) => n + 1)}
          >
            ↺ Sincronizar
          </button>
        </div>
        <p className="muted discord-chat-description">
          Canal compartido con Discord · se actualiza cada 10 segundos mientras esta pestaña está
          visible.
        </p>
        <div className="filter-buttons discord-chat-links">
          {inviteUrl ? (
            <a
              className="button outline small"
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Unirse al servidor de Discord ↗
            </a>
          ) : (
            <span className="muted">Invitación al servidor pendiente de configuración.</span>
          )}
        </div>
        <div className="discord-history-wrap">
          <div
            ref={listRef}
            className="discord-message-list"
            aria-label="Mensajes del canal"
            onScroll={() => {
              const list = listRef.current;
              if (list && discordNearBottom(list.scrollTop, list.clientHeight, list.scrollHeight))
                setNewMessages(false);
            }}
          >
            {loading ? <p role="status">[ Conectando con Discord… ]</p> : null}
            {!loading && !visibleMessages.length && !error ? (
              <p>No hay mensajes en esta frecuencia.</p>
            ) : null}
            {visibleMessages.map((message) => (
              <DiscordMessageCard
                key={message.id}
                message={message}
                onOpen={setActiveMedia}
                canInteract={frequency === 'web-chat'}
                viewerUsername={viewerUsername}
                mentionNames={mentionNames}
                onReply={replyMessage}
                onMention={mentionMessage}
              />
            ))}
          </div>
          {newMessages ? (
            <button
              type="button"
              className="button small discord-new-messages"
              onClick={() => {
                scrollToEnd();
                setNewMessages(false);
              }}
            >
              ↓ Nuevos mensajes
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
        {frequency === 'web-chat' ? (
          <>
            {replyTo && (
              <div className="discord-reply-bar">
                <span>↩ Respondiendo a @{messageAuthor(replyTo)}</span>
                <button
                  type="button"
                  className="button outline small"
                  disabled={sending}
                  onClick={() => setReplyTo(null)}
                >
                  ✕ Cancelar
                </button>
              </div>
            )}
            {gamePicker && !sending && (
              <DiscordGamePicker
                onClose={() => {
                  setGamePicker(false);
                  inputRef.current?.focus();
                }}
                onSelect={(game) => {
                  const insert = `🎮 ${game.title} (${window.location.origin}/games/${encodeURIComponent(game.slug)})`;
                  const next = `${content}${content && !content.endsWith(' ') ? ' ' : ''}${insert}`;
                  if (next.length > 500) {
                    setError(
                      'El juego supera el límite de 500 caracteres; acorta el mensaje primero.',
                    );
                    return;
                  }
                  setContent(next);
                  setGamePicker(false);
                  inputRef.current?.focus();
                }}
              />
            )}
            <form
              className="discord-chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <label>
                <span className="discord-input-label">Mensaje para Discord</span>
                <input
                  ref={inputRef}
                  value={content}
                  maxLength={500}
                  disabled={sending}
                  onChange={(event) => {
                    setContent(event.target.value);
                    setCaret(event.target.selectionStart ?? event.target.value.length);
                    setMentionsOpen(
                      /(?:^|\s)@[^\s@]*$/u.test(
                        event.target.value.slice(
                          0,
                          event.target.selectionStart ?? event.target.value.length,
                        ),
                      ),
                    );
                    setMentionIndex(0);
                  }}
                  onSelect={(event) =>
                    setCaret(event.currentTarget.selectionStart ?? content.length)
                  }
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={mentionsOpen}
                  aria-controls="discord-mention-options"
                  aria-activedescendant={
                    mentionsOpen && suggestions.length
                      ? `discord-mention-${Math.min(mentionIndex, suggestions.length - 1)}`
                      : undefined
                  }
                  onKeyDown={(event) => {
                    if (!mentionsOpen) return;
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setMentionsOpen(false);
                    } else if (
                      (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
                      suggestions.length
                    ) {
                      event.preventDefault();
                      setMentionIndex(
                        (index) =>
                          (index + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) %
                          suggestions.length,
                      );
                    } else if (event.key === 'Enter' && suggestions.length) {
                      event.preventDefault();
                      insertMention(suggestions[Math.min(mentionIndex, suggestions.length - 1)]!);
                    }
                  }}
                  placeholder="Escribe y pulsa Enter…"
                  aria-describedby="discord-message-count"
                />
                <span id="discord-message-count" className="muted discord-character-count">
                  {content.length}/500
                </span>
                {mentionsOpen && (
                  <ul
                    id="discord-mention-options"
                    className="discord-mention-options"
                    role="listbox"
                    aria-label="Usuarios mencionables"
                  >
                    {suggestions.map((target, index) => (
                      <li
                        key={`${target.username}-${target.id}`}
                        id={`discord-mention-${index}`}
                        role="option"
                        aria-selected={index === Math.min(mentionIndex, suggestions.length - 1)}
                      >
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => insertMention(target)}
                        >
                          @{target.username}{' '}
                          <small>
                            {target.id ? 'Discord · notificación' : 'Solo mención en la web'}
                          </small>
                        </button>
                      </li>
                    ))}
                    {!suggestions.length && (
                      <li role="option" aria-selected={false}>
                        No hay usuarios coincidentes.
                      </li>
                    )}
                  </ul>
                )}
              </label>
              <div className="discord-emoji-buttons" role="group" aria-label="Insertar emoji gamer">
                {(['👾', '💾', '🏆', '🔥'] as const).map((emoji) => (
                  <button
                    type="button"
                    className="button outline small"
                    key={emoji}
                    aria-label={`Insertar ${emoji}`}
                    disabled={sending || content.length + emoji.length > 500}
                    onClick={() => {
                      setContent((current) =>
                        current.length + emoji.length <= 500 ? current + emoji : current,
                      );
                      inputRef.current?.focus();
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="button outline small discord-compose-tool"
                disabled={sending}
                aria-label="Mencionar usuario"
                onClick={() => {
                  setMentionsOpen((open) => !open);
                  setMentionIndex(0);
                  setCaret(inputRef.current?.selectionStart ?? content.length);
                  inputRef.current?.focus();
                }}
              >
                @
              </button>
              <button
                type="button"
                className="button outline small discord-compose-tool"
                disabled={sending}
                aria-expanded={gamePicker}
                onClick={() => setGamePicker((open) => !open)}
              >
                🎮 Juego
              </button>
              <button className="button" disabled={sending || cooldown > 0 || !content.trim()}>
                {sending ? 'Enviando…' : cooldown > 0 ? `Espera ${cooldown}s…` : 'Enviar →'}
              </button>
            </form>
            <p className="muted">
              Lo que envíes se publicará en el canal de Discord con tu nombre de usuario de
              SaveState.
            </p>
          </>
        ) : (
          <p className="notice discord-readonly">
            [ MODO LECTURA //{' '}
            {frequency === 'checkpoints' ? 'REGISTRO DE CHECKPOINTS' : 'ANUNCIOS DESTACADOS'} ]
          </p>
        )}
        {activeMedia ? (
          <MediaLightbox
            key={activeMedia.url}
            media={activeMedia}
            onClose={() => setActiveMedia(null)}
          />
        ) : null}
      </section>
      <aside className="discord-sidebar" aria-label="Centro de mando Discord">
        <section className="panel">
          <h2>FRECUENCIAS DISCORD</h2>
          <p className="muted">Canales reales del servidor.</p>
          <ul className="discord-channel-list">
            {(
              [
                ['checkpoints', '#💾-checkpoints', 'Registro real · modo lectura'],
                ['web-chat', '#💬-web-chat', 'Todos los mensajes · envío habilitado'],
                ['announcements', '#📢-anuncios-savestate', 'Anuncios del servidor · modo lectura'],
              ] as const
            ).map(([value, label, description]) => (
              <li key={value}>
                <button
                  type="button"
                  className={`discord-channel-pill${frequency === value ? ' active' : ''}`}
                  aria-pressed={frequency === value}
                  disabled={sending}
                  onClick={() => selectFrequency(value)}
                >
                  <strong>{label}</strong>
                  <span>{description}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <DiscordLinkedRoleCard />
        <section className="panel discord-presence" aria-labelledby="discord-presence-heading">
          <h2 id="discord-presence-heading">MIEMBROS EN LÍNEA</h2>
          <p className="discord-presence-count" role="status">
            {loading ? 'Consultando presencia…' : `🟢 ${presence.onlineCount} conectados`}
          </p>
          <ul className="discord-presence-list">
            {presence.members.map((member) => (
              <li key={member.id} className="discord-presence-member">
                <span className="discord-presence-avatar">
                  {member.avatar ? (
                    <Image src={member.avatar} alt="" width={28} height={28} unoptimized />
                  ) : (
                    <span aria-hidden="true">▣</span>
                  )}
                  <span
                    className={`discord-presence-dot status-${member.status}`}
                    role="img"
                    aria-label={
                      member.status === 'online'
                        ? 'En línea'
                        : member.status === 'idle'
                          ? 'Ausente'
                          : 'No molestar'
                    }
                  />
                </span>
                <span className="discord-presence-copy">
                  <strong>{member.username}</strong>
                  {member.game ? <small>🕹️ Jugando a {member.game}</small> : null}
                </span>
              </li>
            ))}
          </ul>
          {!loading && !presence.members.length ? (
            <p className="muted">Sin miembros visibles en el widget.</p>
          ) : null}
        </section>
        <section className="panel">
          <h2>ESTADO DEL NODO</h2>
          <p className="discord-node-status" role="status">
            <span className={node.online ? 'live-pulse' : ''} aria-hidden="true">
              {node.online ? '🟢' : '◌'}
            </span>{' '}
            {loading ? 'CONECTANDO' : node.online ? 'ONLINE' : 'SIN CONEXIÓN'}
          </p>
          <p className="muted">
            Latencia del relay: {node.latency === null ? '—' : `${node.latency} ms`}
          </p>
          <p className="muted">
            Estado de la última consulta al canal mediante el bot · refresco cada 10 s.
          </p>
          {inviteUrl ? (
            <a
              className="button discord-join"
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Unirse al servidor ↗
            </a>
          ) : (
            <p className="muted">Invitación pendiente de configuración.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
