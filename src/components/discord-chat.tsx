'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { DiscordMessage } from '@/domain/discord';
import { discordMessageOrigin, discordImageAttachment, discordInlineMedia } from '@/domain/discord';
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
export function DiscordChat({ inviteUrl, siteUrl }: { inviteUrl: string | null; siteUrl: string }) {
  const [activeMedia, setActiveMedia] = useState<ActiveMedia | null>(null);
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [content, setContent] = useState(''),
    [error, setError] = useState('');
  const [loading, setLoading] = useState(true),
    [sending, setSending] = useState(false);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const cooldownUntil = useRef(0);
  const [cooldown, setCooldown] = useState(0);
  const messageSignature = messages.map((message) => `${message.id}:${message.content}`).join('|');
  useEffect(() => {
    if (!messageSignature) return;
    endRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'nearest',
    });
  }, [messageSignature]);
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
      try {
        const response = await fetch('/api/discord/messages', {
          signal: request.signal,
          cache: 'no-store',
        });
        const data = await readJsonResponse<{ messages: DiscordMessage[] }>(response);
        if (!disposed && !request.signal.aborted) {
          if (!busy.current) setMessages(data.messages);
          setError('');
        }
      } catch (failure) {
        if (!disposed && !request.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'No se pudo leer Discord.');
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
  }, [revision]);
  async function send() {
    if (busy.current || Date.now() < cooldownUntil.current || !content.trim()) return;
    busy.current = true;
    setSending(true);
    setError('');
    cooldownUntil.current = Date.now() + 3000;
    setCooldown(3);
    try {
      const result = await api<{ message: DiscordMessage | null }>('discord/messages', { content });
      if (result.message)
        setMessages((current) =>
          [
            ...current.filter((message) => message.id !== result.message!.id),
            result.message!,
          ].slice(-30),
        );
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
    <section className="panel discord-chat">
      <div className="form-row">
        <h2>Discord Bridge · Terminal comunitaria</h2>
        <span className="discord-live" role="status">
          <span className={!loading && !error ? 'live-pulse' : ''} aria-hidden="true">
            {!loading && !error ? '🟢' : '◌'}
          </span>{' '}
          {loading ? 'CONECTANDO' : error ? 'SYNC EN PAUSA' : 'LIVE SYNC'} // #web-chat
        </span>
        <button
          type="button"
          className="button outline small"
          onClick={() => setRevision((n) => n + 1)}
        >
          ↺ Sincronizar
        </button>
      </div>
      <p className="muted">
        Canal compartido con Discord · se actualiza cada 10 segundos mientras esta pestaña está
        visible.
      </p>
      <div className="filter-buttons">
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
        <a className="button outline small" href={siteUrl}>
          🌐 Ver SaveState
        </a>
      </div>
      <div className="discord-message-list" aria-label="Mensajes del canal">
        {loading ? <p role="status">[ Conectando con Discord… ]</p> : null}
        {!loading && !messages.length && !error ? <p>No hay mensajes todavía.</p> : null}
        {messages.map((message) => {
          const origin = discordMessageOrigin(message.content);
          const media = discordInlineMedia(origin.content);
          return (
            <article key={message.id} className="discord-message">
              {message.avatar ? (
                <Image src={message.avatar} width={36} height={36} alt="" unoptimized />
              ) : (
                <span aria-hidden="true">▣</span>
              )}
              <div>
                <span className={origin.web ? 'badge-savestate' : 'badge-discord'}>
                  {origin.web ? '[SAVESTATE_WEB]' : '[DISCORD]'}
                </span>{' '}
                <strong className="accent">{origin.author ?? message.author}</strong>{' '}
                <time dateTime={message.createdAt} title="Hora de Chile · America/Santiago">
                  {formatMessageDate(message.createdAt)}
                </time>
                {media.text ? (
                  <p>{media.text}</p>
                ) : !media.urls.length ? (
                  <p>Mensaje sin texto disponible.</p>
                ) : null}
                {media.urls.map((url) => (
                  <InlineMedia key={url} url={url} onOpen={setActiveMedia} />
                ))}
                {message.attachments.map((file) => (
                  <p key={file.url}>
                    {discordImageAttachment(file.url) ? (
                      <button
                        type="button"
                        className="discord-media-button"
                        aria-label={`Ampliar ${file.name}`}
                        aria-haspopup="dialog"
                        onClick={() => setActiveMedia({ url: file.url, alt: file.name })}
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
        })}
        <div ref={endRef} aria-hidden="true" />
      </div>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <form
        className="form-row"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label>
          Mensaje para Discord
          <input
            value={content}
            maxLength={500}
            disabled={sending}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Escribe y pulsa Enter…"
          />
          <span className="muted discord-character-count">{content.length}/500</span>
        </label>
        <button className="button" disabled={sending || cooldown > 0 || !content.trim()}>
          {sending ? 'Enviando…' : cooldown > 0 ? `Espera ${cooldown}s…` : 'Enviar →'}
        </button>
      </form>
      <p className="muted">
        Lo que envíes se publicará en el canal de Discord con tu nombre de usuario de SaveState.
      </p>
      {activeMedia ? (
        <MediaLightbox
          key={activeMedia.url}
          media={activeMedia}
          onClose={() => setActiveMedia(null)}
        />
      ) : null}
    </section>
  );
}
