'use client';
import Image from 'next/image';
import Link from 'next/link';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DiscordMessage, DiscordOnlineMember, DiscordFrequency } from '@/domain/discord';
import {
  discordMessageOrigin,
  discordImageAttachment,
  discordInlineMedia,
  discordFrequencyMessages,
  sameDiscordMessages,
  discordNearBottom,
} from '@/domain/discord';
import { api } from '@/lib/client-api';
import { readJsonResponse } from '@/lib/api-response';
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
}: {
  message: DiscordMessage;
  onOpen: (media: ActiveMedia) => void;
}) {
  const origin = discordMessageOrigin(message.content);
  const media = discordInlineMedia(origin.content);
  return (
    <article key={message.id} className="discord-message">
      {message.avatar ? (
        <Image src={message.avatar} width={36} height={36} alt="" unoptimized />
      ) : (
        <span aria-hidden="true">▣</span>
      )}
      <div className="discord-message-bubble">
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
          <p>{media.text}</p>
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
  const [activeMedia, setActiveMedia] = useState<ActiveMedia | null>(null);
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [presence, setPresence] = useState<{ onlineCount: number; members: DiscordOnlineMember[] }>(
    { onlineCount: 0, members: [] },
  );
  const [content, setContent] = useState(''),
    [error, setError] = useState('');
  const [loading, setLoading] = useState(true),
    [sending, setSending] = useState(false);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [frequency, setFrequency] = useState<DiscordFrequency>('web-chat');
  const [newMessages, setNewMessages] = useState(false);
  const pendingScroll = useRef(true);
  const messagesRef = useRef<DiscordMessage[]>([]);
  const visibleMessages = useMemo(
    () => discordFrequencyMessages(messages, frequency),
    [messages, frequency],
  );
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
    pendingScroll.current = true;
    setNewMessages(false);
    setFrequency(next);
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
        const response = await fetch('/api/discord/messages', {
          signal: request.signal,
          cache: 'no-store',
        });
        const data = await readJsonResponse<{
          messages: DiscordMessage[];
          presence: typeof presence;
        }>(response);
        if (!disposed && !request.signal.aborted) {
          if (!busy.current && !sameDiscordMessages(messagesRef.current, data.messages)) {
            const previous = messagesRef.current;
            const hasNew = discordFrequencyMessages(data.messages, frequency).some(
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
          setError('');
          setNode({ online: true, latency: Math.round(performance.now() - started) });
        }
      } catch (failure) {
        if (!disposed && !request.signal.aborted) {
          setNode({ online: false, latency: null });
          setPresence({ onlineCount: 0, members: [] });
          setError(failure instanceof Error ? failure.message : 'No se pudo leer Discord.');
        }
      } finally {
        if (!disposed && !request.signal.aborted) setLoading(false);
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
      const result = await api<{ message: DiscordMessage | null }>('discord/messages', { content });
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
              <DiscordMessageCard key={message.id} message={message} onOpen={setActiveMedia} />
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
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Escribe y pulsa Enter…"
                  aria-describedby="discord-message-count"
                />
                <span id="discord-message-count" className="muted discord-character-count">
                  {content.length}/500
                </span>
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
          <h2>FRECUENCIAS DISCORD</h2>
          <p className="muted">Filtros del canal sincronizado.</p>
          <ul className="discord-channel-list">
            {(
              [
                ['checkpoints', '#💾-checkpoints', 'Avisos de bots y webhooks'],
                ['web-chat', '#💬-web-chat', 'Todos los mensajes · envío habilitado'],
                ['announcements', '#📢-anuncios-savestate', 'Mensajes fijados · modo lectura'],
              ] as const
            ).map(([value, label, description]) => (
              <li key={value}>
                <button
                  type="button"
                  className={`discord-channel-pill${frequency === value ? ' active' : ''}`}
                  aria-pressed={frequency === value}
                  onClick={() => selectFrequency(value)}
                >
                  <strong>{label}</strong>
                  <span>{description}</span>
                </button>
              </li>
            ))}
          </ul>
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
