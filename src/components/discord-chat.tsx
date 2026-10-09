'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { DiscordMessage } from '@/domain/discord';
import { api } from '@/lib/client-api';
import { readJsonResponse } from '@/lib/api-response';
export function DiscordChat() {
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [content, setContent] = useState(''),
    [error, setError] = useState('');
  const [loading, setLoading] = useState(true),
    [sending, setSending] = useState(false);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
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
    if (busy.current || !content.trim()) return;
    busy.current = true;
    setSending(true);
    setError('');
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
      <div className="discord-message-list" aria-label="Mensajes del canal">
        {loading ? <p role="status">[ Conectando con Discord… ]</p> : null}
        {!loading && !messages.length && !error ? <p>No hay mensajes todavía.</p> : null}
        {messages.map((message) => (
          <article key={message.id} className="discord-message">
            {message.avatar ? (
              <Image src={message.avatar} width={36} height={36} alt="" unoptimized />
            ) : (
              <span aria-hidden="true">▣</span>
            )}
            <div>
              <strong className="accent">{message.author}</strong>{' '}
              <time dateTime={message.createdAt}>
                {message.createdAt.slice(0, 16).replace('T', ' ')} UTC
              </time>
              <p>{message.content || 'Mensaje sin texto disponible.'}</p>
              {message.attachments.map((file) => (
                <p key={file.url}>
                  <a href={file.url} target="_blank" rel="noopener noreferrer">
                    ↗ {file.name}
                  </a>
                </p>
              ))}
            </div>
          </article>
        ))}
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
        </label>
        <button className="button" disabled={sending || !content.trim()}>
          {sending ? 'Enviando…' : 'Enviar →'}
        </button>
      </form>
      <p className="muted">
        Lo que envíes se publicará en el canal de Discord con tu nombre de usuario de SaveState.
      </p>
    </section>
  );
}
