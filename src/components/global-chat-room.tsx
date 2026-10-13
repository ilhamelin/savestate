'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { browserClient } from '@/integrations/supabase/browser';
import { isConfigured, publicEnv } from '@/lib/env';
import {
  chatFileSignature,
  detectMediaType,
  mergeChatMessages,
  safeChatMediaUrl,
  validateChatFile,
  type GlobalChatMessage,
} from '@/domain/global-chat';

type Viewer = { id: string; username: string; avatar_url: string | null } | null;
type History = { messages: GlobalChatMessage[]; nextCursor: string | null };
async function chatRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo conectar con el chat.');
  return result as T;
}
function ChatText({ text }: { text: string }) {
  return (
    <p className="chat-message-text">
      {text.split(/(https?:\/\/[^\s<>]+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}
function MediaViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="chat-media-dialog"
      aria-label="Visor de imagen o GIF"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="filter-buttons">
        <a className="button outline small" href={url} target="_blank" rel="noopener noreferrer">
          ↗ Abrir original
        </a>
        <button type="button" className="button small" onClick={onClose}>
          ✕ Cerrar
        </button>
      </div>
      <Image src={url} alt="Imagen compartida en el chat" width={1200} height={900} unoptimized />
    </dialog>
  );
}
export function GlobalChatRoom({
  initialMessages,
  initialCursor,
  viewer,
  initialError,
}: {
  initialMessages: GlobalChatMessage[];
  initialCursor: string | null;
  viewer: Viewer;
  initialError?: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [cursor, setCursor] = useState(initialCursor);
  const [connection, setConnection] = useState('Conectando…');
  const [error, setError] = useState(initialError ?? '');
  const [olderLoading, setOlderLoading] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const [text, setText] = useState('');
  const [media, setMedia] = useState<{ url: string; file?: File; uploadedUrl?: string } | null>(
    null,
  );
  const [urlEditor, setUrlEditor] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [activeMedia, setActiveMedia] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nearBottom = useRef(true);
  const knownIds = useRef(new Set(initialMessages.map((message) => message.id)));
  const olderAnchor = useRef<{ height: number; top: number } | null>(null);
  const pendingScroll = useRef(true);
  const receive = useCallback((incoming: GlobalChatMessage[], own = false) => {
    const fresh = incoming.filter((message) => !knownIds.current.has(message.id));
    if (!fresh.length) return;
    fresh.forEach((message) => knownIds.current.add(message.id));
    if (own || nearBottom.current) pendingScroll.current = true;
    else setNewMessages(true);
    setMessages((previous) => mergeChatMessages(previous, fresh));
  }, []);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (olderAnchor.current) {
      element.scrollTop =
        olderAnchor.current.top + element.scrollHeight - olderAnchor.current.height;
      olderAnchor.current = null;
    } else if (pendingScroll.current) {
      element.scrollTop = element.scrollHeight;
      pendingScroll.current = false;
    }
  }, [messages]);
  useEffect(() => {
    if (!isConfigured()) return;
    const client = browserClient();
    let alive = true;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const history = await chatRequest<History>('/api/chat/messages', {
          signal: controller.signal,
        });
        if (alive) receive(history.messages);
      } catch {
        /* Realtime reconnect and polling retry without disrupting the composer. */
      }
    };
    const channel = client
      .channel('global-chat-room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'global_chat_messages' },
        (payload) => {
          void chatRequest<{ message: GlobalChatMessage }>(
            `/api/chat/messages?id=${encodeURIComponent(String(payload.new.id))}`,
            { signal: controller.signal },
          )
            .then((result) => {
              if (alive) receive([result.message]);
            })
            .catch(() => {
              void refresh();
            });
        },
      )
      .subscribe((status) => {
        if (!alive) return;
        setConnection(status === 'SUBSCRIBED' ? 'EN VIVO' : 'Reconectando…');
        if (status === 'SUBSCRIBED') void refresh();
      });
    const interval = window.setInterval(() => {
      void refresh();
    }, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      void client.removeChannel(channel);
    };
  }, [receive]);
  useEffect(() => {
    const url = media?.file ? media.url : null;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [media?.url, media?.file]);
  async function loadOlder() {
    if (!cursor || olderLoading) return;
    setOlderLoading(true);
    setError('');
    try {
      const history = await chatRequest<History>(
        `/api/chat/messages?before=${encodeURIComponent(cursor)}`,
      );
      const element = scrollRef.current;
      if (element) olderAnchor.current = { height: element.scrollHeight, top: element.scrollTop };
      history.messages.forEach((message) => knownIds.current.add(message.id));
      setMessages((previous) => mergeChatMessages(history.messages, previous));
      setCursor(history.nextCursor);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setOlderLoading(false);
    }
  }
  async function selectFile(file?: File) {
    if (!file) return;
    try {
      validateChatFile(file.size, file.type);
      if (!chatFileSignature(new Uint8Array(await file.slice(0, 12).arrayBuffer()), file.type))
        throw new Error('El archivo no contiene una imagen válida.');
      setMedia({ file, url: URL.createObjectURL(file) });
      setError('');
    } catch (error) {
      setError((error as Error).message);
    }
    if (fileRef.current) fileRef.current.value = '';
  }
  function attachUrl() {
    const url = safeChatMediaUrl(
      urlDraft.trim(),
      isConfigured() ? publicEnv().url : undefined,
      viewer?.id,
    );
    if (!url) {
      setError(
        'Pega un enlace directo HTTPS de Tenor, Giphy, Imgur o Discord (PNG, JPG, WebP o GIF).',
      );
      return;
    }
    setMedia({ url });
    setUrlEditor(false);
    setUrlDraft('');
    setError('');
  }
  async function send() {
    if (sending || (!text.trim() && !media)) return;
    setSending(true);
    setError('');
    try {
      let mediaUrl = media?.uploadedUrl ?? media?.url ?? null;
      if (media?.file && !media.uploadedUrl) {
        const signed = await chatRequest<{ path: string; token: string; url: string }>(
          '/api/chat/upload',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ size: media.file.size, contentType: media.file.type }),
          },
        );
        const { error } = await browserClient()
          .storage.from('chat-media')
          .uploadToSignedUrl(signed.path, signed.token, media.file, {
            contentType: media.file.type,
          });
        if (error) throw new Error('No se pudo subir el archivo. Inténtalo nuevamente.');
        mediaUrl = signed.url;
        setMedia({ ...media, uploadedUrl: signed.url });
      }
      const result = await chatRequest<{ data: GlobalChatMessage }>('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          mediaUrl,
          mediaType: mediaUrl ? detectMediaType(mediaUrl) : null,
        }),
      });
      receive([result.data], true);
      setText('');
      setMedia(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSending(false);
    }
  }
  function jumpToBottom() {
    const element = scrollRef.current;
    element?.scrollTo({
      top: element.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
    setNewMessages(false);
  }
  return (
    <section className="panel global-chat-container" aria-label="Chat Global Arcade Lounge">
      <header className="chat-room-header">
        <div>
          <p className="eyebrow">ARCADE LOUNGE // FRECUENCIA PÚBLICA</p>
          <h1>Chat Global</h1>
          <p className="muted">
            La comunidad en una misma sala. Comparte tu partida, imágenes y GIFs.
          </p>
        </div>
        <span className="chat-live-status" role="status">
          ● {connection}
        </span>
      </header>
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      <div className="chat-scroll-wrap">
        <div
          className="chat-messages-scroll"
          ref={scrollRef}
          role="region"
          aria-label="Mensajes del chat"
          onScroll={() => {
            const element = scrollRef.current;
            if (element) {
              nearBottom.current =
                element.scrollHeight - element.scrollTop - element.clientHeight < 80;
              if (nearBottom.current) setNewMessages(false);
            }
          }}
        >
          {cursor && (
            <button
              type="button"
              className="button outline small chat-history-button"
              disabled={olderLoading}
              onClick={() => void loadOlder()}
            >
              {olderLoading ? 'Cargando…' : '↑ Cargar mensajes anteriores'}
            </button>
          )}
          {!messages.length && (
            <p className="muted chat-empty">
              La sala está lista. Sé el primero en iniciar la conversación.
            </p>
          )}
          {messages.map((message) => (
            <article
              className={`chat-bubble ${viewer?.id === message.userId ? 'chat-bubble-own' : ''}`}
              key={message.id}
            >
              <Link
                className="chat-avatar"
                href={`/players/${encodeURIComponent(message.author.username)}`}
                aria-label={`Perfil de ${message.author.username}`}
              >
                {message.author.avatarUrl ? (
                  <Image src={message.author.avatarUrl} alt="" width={36} height={36} unoptimized />
                ) : (
                  <span aria-hidden="true">▣</span>
                )}
              </Link>
              <div className="chat-bubble-content">
                <div className="chat-bubble-heading">
                  <Link href={`/players/${encodeURIComponent(message.author.username)}`}>
                    @{message.author.username}
                  </Link>
                  {viewer?.id === message.userId && <span className="chat-own-badge">TÚ</span>}
                  <time dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleString('es-CL', {
                      timeZone: 'America/Santiago',
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </time>
                </div>
                {message.content && <ChatText text={message.content} />}
                {message.mediaUrl && (
                  <div className="chat-inline-media">
                    <button
                      type="button"
                      className="chat-media-button"
                      aria-label="Ampliar imagen o GIF"
                      onClick={() => setActiveMedia(message.mediaUrl)}
                    >
                      <Image
                        src={message.mediaUrl}
                        alt="Imagen compartida"
                        width={600}
                        height={400}
                        loading="lazy"
                        unoptimized
                      />
                    </button>
                    {message.mediaType === 'gif' && <span className="chat-gif-badge">GIF</span>}
                    <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
                      ↗ Abrir original
                    </a>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
        {newMessages && (
          <button type="button" className="button small chat-new-messages" onClick={jumpToBottom}>
            ↓ Nuevos mensajes
          </button>
        )}
      </div>
      {viewer ? (
        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label htmlFor="global-chat-message">
            Tu mensaje{' '}
            <span className="muted">
              {text.length}/1000 · Enter para enviar · Shift+Enter para salto
            </span>
          </label>
          <textarea
            id="global-chat-message"
            value={text}
            maxLength={1000}
            rows={3}
            placeholder="Comparte algo con la comunidad…"
            disabled={sending}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
          />
          {media && (
            <div className="chat-media-preview">
              <Image
                src={media.url}
                alt="Vista previa del adjunto"
                width={200}
                height={150}
                unoptimized
              />
              <span>{media.file?.name ?? 'Imagen / GIF enlazado'}</span>
              <button
                type="button"
                className="button outline small"
                disabled={sending}
                onClick={() => setMedia(null)}
              >
                ✕ Quitar adjunto
              </button>
            </div>
          )}
          {urlEditor && (
            <div className="chat-url-editor">
              <label htmlFor="chat-media-url">URL directa de imagen / GIF</label>
              <input
                id="chat-media-url"
                type="url"
                value={urlDraft}
                maxLength={2000}
                placeholder="https://i.imgur.com/imagen.gif"
                onChange={(event) => setUrlDraft(event.target.value)}
              />
              <button type="button" className="button small" onClick={attachUrl}>
                Adjuntar
              </button>
              <button
                type="button"
                className="button outline small"
                onClick={() => setUrlEditor(false)}
              >
                Cancelar
              </button>
            </div>
          )}
          <div className="chat-composer-actions">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="chat-file-input"
              aria-label="Seleccionar imagen o GIF"
              onChange={(event) => void selectFile(event.target.files?.[0])}
              disabled={sending}
            />
            <button
              type="button"
              className="button outline small"
              disabled={sending}
              onClick={() => fileRef.current?.click()}
            >
              📎 Subir Imagen / GIF
            </button>
            <button
              type="button"
              className="button outline small"
              disabled={sending}
              aria-expanded={urlEditor}
              onClick={() => setUrlEditor((previous) => !previous)}
            >
              🔗 URL
            </button>
            <span className="muted">Máximo 5 MB · Archivos públicos</span>
            <button type="submit" className="button" disabled={sending || (!text.trim() && !media)}>
              {sending ? 'Enviando…' : 'Enviar →'}
            </button>
          </div>
        </form>
      ) : (
        <div className="chat-spectator">
          <p>
            🔒 Estás en modo espectador. Inicia sesión en SaveState para enviar mensajes, imágenes y
            GIFs en el Chat Global.
          </p>
          <Link className="button" href="/login?next=/chat">
            Conectar / Registrarse
          </Link>
        </div>
      )}
      {activeMedia && <MediaViewer url={activeMedia} onClose={() => setActiveMedia(null)} />}
    </section>
  );
}
