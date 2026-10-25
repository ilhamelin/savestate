'use client';
import { VaultVideo } from '@/components/vault-video';
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
  discordSharedGame,
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
import { VaultPicker } from '@/components/vault-picker';
import { browserClient } from '@/integrations/supabase/browser';
import { publicEnv } from '@/lib/env';
import {
  chatFileSignature,
  chatMediaPageUrl,
  safeChatMediaUrl,
  validateChatFile,
} from '@/domain/global-chat';
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
        ) : /\.(mp4|webm)$/.test(new URL(media.url).pathname) ? (
          <VaultVideo
            className="discord-lightbox-image"
            src={media.url}
            controls
            autoPlay
            playsInline
            aria-label={media.alt ?? 'Clip compartido'}
          />
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
  const pageUrl = chatMediaPageUrl(url);
  if (pageUrl)
    return (
      <p className="muted">
        <a href={pageUrl} target="_blank" rel="noopener noreferrer">
          🔗 Ver GIF / publicación en {new URL(pageUrl).hostname} ↗
        </a>
      </p>
    );
  if (/\.(mp4|webm)$/.test(new URL(url).pathname))
    return (
      <div>
        <VaultVideo
          className="discord-inline-media"
          src={url}
          controls
          preload="metadata"
          playsInline
          aria-label="Clip compartido"
        />
        <button
          type="button"
          className="button outline small"
          onClick={() => onOpen({ url, alt: 'Clip compartido' })}
        >
          🔍 Ampliar clip
        </button>
      </div>
    );
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
  const sharedGame =
    typeof window === 'undefined'
      ? null
      : discordSharedGame(origin.content, window.location.origin);
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
          {origin.web ? '[SAVESTATE]' : '[DISCORD]'}
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
        {sharedGame && (
          <Link className="discord-game-card-embed" href={sharedGame.href}>
            <small>🎮 Juego</small>
            <strong>{sharedGame.title}</strong>
            <small>Ver ficha ↗</small>
          </Link>
        )}
        {media.urls.map((url) => (
          <InlineMedia key={url} url={url} onOpen={onOpen} />
        ))}
        {message.attachments
          .filter((file) => !media.urls.includes(file.url))
          .map((file) => (
            <div key={file.url}>
              {discordImageAttachment(file.url) || discordInlineMedia(file.url).urls.length ? (
                <InlineMedia url={file.url} onOpen={onOpen} />
              ) : (
                <a href={file.url} target="_blank" rel="noopener noreferrer">
                  ↗ {file.name}
                </a>
              )}
            </div>
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<{
    url: string;
    vaultItemId?: string;
    mimeType?: string;
    file?: File;
    uploadedUrl?: string;
    privatePath?: string;
  } | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
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
  const [vaultPicker, setVaultPicker] = useState(false);
  const [presence, setPresence] = useState<{ onlineCount: number; members: DiscordOnlineMember[] }>(
    { onlineCount: 0, members: [] },
  );
  const [content, setContent] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    const url = attachment?.file ? attachment.url : null;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment?.url, attachment?.file]);
  async function attachFile(file?: File) {
    if (!file || busy.current) return;
    try {
      validateChatFile(file.size, file.type);
      if (!chatFileSignature(new Uint8Array(await file.slice(0, 12).arrayBuffer()), file.type))
        throw new Error('El archivo no contiene una imagen válida.');
      setAttachment({ file, url: URL.createObjectURL(file) });
      setError('');
    } catch (failure) {
      setError((failure as Error).message);
    }
    if (fileRef.current) fileRef.current.value = '';
  }
  function attachUrl() {
    const url = safeChatMediaUrl(urlDraft.trim(), publicEnv().url);
    if (!url) {
      setError('Usa una URL HTTPS de imagen/GIF autorizada o una página de Tenor, Giphy o Imgur.');
      return;
    }
    setAttachment({ url });
    setUrlDraft('');
    setUrlOpen(false);
    setError('');
  }
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
  const [privateChatAccess, setPrivateChatAccess] = useState({
    canRead: false,
    canSend: false,
    canAttach: false,
  });
  const writableFrequency =
    frequency === 'web-chat' || (frequency === 'chat-privado' && privateChatAccess.canSend);
  const canAttach = frequency !== 'chat-privado' || privateChatAccess.canAttach;
  const frequencyRef = useRef<DiscordFrequency>('web-chat');
  const [newMessages, setNewMessages] = useState(false);
  const pendingScroll = useRef(true);
  const smoothScroll = useRef(false);
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
    if (next === 'chat-privado' && !privateChatAccess.canRead) return;
    frequencyRef.current = next;
    pendingScroll.current = true;
    smoothScroll.current = false;
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
    setContent('');
    setAttachment(null);
    setUrlDraft('');
    setUrlOpen(false);
    setActiveMedia(null);
  }
  const cooldownUntil = useRef(0);
  const [cooldown, setCooldown] = useState(0);
  useLayoutEffect(() => {
    if (!pendingScroll.current) return;
    pendingScroll.current = false;
    const list = listRef.current;
    list?.scrollTo({
      top: list.scrollHeight,
      behavior:
        smoothScroll.current &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'smooth'
          : 'instant',
    });
    smoothScroll.current = false;
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
        if (
          response.status === 403 &&
          frequency === 'chat-privado' &&
          !disposed &&
          !request.signal.aborted
        ) {
          setPrivateChatAccess({ canRead: false, canSend: false, canAttach: false });
          messagesRef.current = [];
          setMessages([]);
          setContent('');
          setAttachment(null);
          setReplyTo(null);
          setActiveMedia(null);
          setUrlOpen(false);
          setUrlDraft('');
          setSelectedMentions([]);
          setMentionsOpen(false);
          setGamePicker(false);
          frequencyRef.current = 'web-chat';
          setFrequency('web-chat');
          return;
        }
        const data = await readJsonResponse<{
          messages: DiscordMessage[];
          presence: typeof presence;
          viewerUsername: string | null;
          privateChatAccess?: typeof privateChatAccess;
        }>(response);
        if (!disposed && !request.signal.aborted && frequencyRef.current === frequency) {
          setPrivateChatAccess(
            data.privateChatAccess ?? { canRead: false, canSend: false, canAttach: false },
          );
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
              smoothScroll.current = Boolean(previous.length && nearBottom);
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
      !node.online ||
      loading ||
      !writableFrequency ||
      (attachment && !canAttach) ||
      busy.current ||
      Date.now() < cooldownUntil.current ||
      (!content.trim() && !attachment)
    )
      return;
    busy.current = true;
    setSending(true);
    setError('');
    cooldownUntil.current = Date.now() + 3000;
    setCooldown(3);
    try {
      let mediaUrl = attachment?.file
        ? (attachment.uploadedUrl ?? null)
        : (attachment?.url ?? null);
      let privateAttachmentPath = attachment?.privatePath;
      if (attachment?.file && !attachment.uploadedUrl && !privateAttachmentPath) {
        const uploadInput = { size: attachment.file.size, contentType: attachment.file.type };
        type Prepared = { path: string; token: string; url?: string; bucket?: string };
        const prepared =
          frequency === 'chat-privado'
            ? await api<Prepared>('discord/private-upload', uploadInput)
            : await readJsonResponse<Prepared>(
                await fetch('/api/chat/upload', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(uploadInput),
                }),
              );
        const { error: uploadError } = await browserClient()
          .storage.from(prepared.bucket ?? 'chat-media')
          .uploadToSignedUrl(prepared.path, prepared.token, attachment.file, {
            contentType: attachment.file.type,
          });
        if (uploadError)
          throw new Error('No se pudo subir el adjunto. Puedes volver a intentarlo.');
        if (frequency === 'chat-privado') {
          privateAttachmentPath = prepared.path;
          mediaUrl = null;
          setAttachment({ ...attachment, privatePath: prepared.path });
        } else {
          mediaUrl = prepared.url ?? null;
          setAttachment({ ...attachment, uploadedUrl: prepared.url });
        }
      }
      const result = await api<{ message: DiscordMessage | null }>('discord/messages', {
        content,
        mediaUrl,
        vaultItemId: attachment?.vaultItemId,
        channel: frequency,
        privateAttachmentPath,
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
        smoothScroll.current = true;
        setNewMessages(false);
        messagesRef.current = next;
        setMessages(next);
      }
      setContent('');
      setAttachment(null);
      setUrlOpen(false);
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
      {vaultPicker && (
        <VaultPicker
          onClose={() => setVaultPicker(false)}
          onSelect={(item) => {
            setAttachment({ url: item.publicUrl, vaultItemId: item.id, mimeType: item.mime_type });
            setVaultPicker(false);
          }}
        />
      )}
      <section className="panel discord-chat">
        <header className="discord-chat-heading">
          <div className="discord-terminal-identity">
            <div className="discord-terminal-bar">
              <span className="discord-terminal-leds" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>TERMINAL://COMMUNITY_RELAY</span>
            </div>
            <h2>
              <span className="discord-channel-hash">#</span>
              {frequency === 'announcements'
                ? '📢-anuncios-savestate'
                : frequency === 'checkpoints'
                  ? '💾-checkpoints'
                  : frequency === 'chat-privado'
                    ? '〘🕵〙chat-privado'
                    : '💬-web-chat'}
            </h2>
          </div>
          <div className="discord-heading-actions">
            <span className="discord-live" role="status">
              {loading ? 'CONECTANDO' : node.online ? 'LIVE SYNC' : 'SYNC EN PAUSA'} //{' '}
              {node.latency === null ? '—' : `${node.latency}ms`}
            </span>
            <button
              type="button"
              className="button outline small"
              disabled={loading || sending}
              aria-label="Sincronizar mensajes del canal"
              onClick={() => {
                setLoading(true);
                setRevision((n) => n + 1);
              }}
            >
              ↺ Sincronizar
            </button>
          </div>
        </header>
        <p className="muted discord-chat-description">
          {visibleMessages.length} mensajes · actualización cada 10 s con la pestaña visible.
        </p>
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
            {loading && !visibleMessages.length ? (
              <p role="status">[ Conectando con Discord… ]</p>
            ) : null}
            {!loading && !visibleMessages.length && !error ? (
              <p>No hay mensajes en esta frecuencia.</p>
            ) : null}
            {visibleMessages.map((message) => (
              <DiscordMessageCard
                key={message.id}
                message={message}
                onOpen={setActiveMedia}
                canInteract={writableFrequency}
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
        {writableFrequency ? (
          <div className="discord-composer-container">
            <div className="discord-composer-extras">
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
              {attachment && (
                <div className="chat-media-preview discord-attachment-preview">
                  {attachment.mimeType?.startsWith('video/') ? (
                    <VaultVideo
                      src={attachment.url}
                      controls
                      preload="metadata"
                      playsInline
                      aria-label="Clip adjunto de la bóveda"
                    />
                  ) : chatMediaPageUrl(attachment.url) ? (
                    <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                      🔗 Enlace de GIF listo para enviar ↗
                    </a>
                  ) : (
                    <Image
                      src={attachment.url}
                      alt="Vista previa de imagen o GIF adjunto"
                      width={200}
                      height={150}
                      unoptimized
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span>{attachment.file?.name ?? 'Imagen / GIF enlazado'}</span>
                  <button
                    type="button"
                    className="button outline small"
                    disabled={sending}
                    onClick={() => setAttachment(null)}
                  >
                    ✕ Quitar
                  </button>
                </div>
              )}
              {urlOpen && (
                <div className="chat-url-editor">
                  <label htmlFor="discord-media-url">
                    URL de imagen/GIF o página de Tenor, Giphy o Imgur
                  </label>
                  <input
                    id="discord-media-url"
                    type="url"
                    value={urlDraft}
                    maxLength={2000}
                    disabled={sending}
                    placeholder="https://i.imgur.com/imagen.gif"
                    onChange={(event) => setUrlDraft(event.target.value)}
                  />
                  <button
                    type="button"
                    className="button small"
                    disabled={sending}
                    onClick={attachUrl}
                  >
                    Adjuntar URL
                  </button>
                  <button
                    type="button"
                    className="button outline small"
                    disabled={sending}
                    onClick={() => setUrlOpen(false)}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
            <form
              className="discord-chat-form discord-advanced-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <label>
                <span className="discord-input-label">Mensaje para Discord</span>
                <textarea
                  ref={inputRef}
                  rows={3}
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
                    if (mentionsOpen && event.key === 'Escape') {
                      event.preventDefault();
                      setMentionsOpen(false);
                    } else if (
                      mentionsOpen &&
                      (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
                      suggestions.length
                    ) {
                      event.preventDefault();
                      setMentionIndex(
                        (index) =>
                          (index + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) %
                          suggestions.length,
                      );
                    } else if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.ctrlKey &&
                      !event.metaKey &&
                      !event.altKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      if (mentionsOpen && suggestions.length)
                        insertMention(suggestions[Math.min(mentionIndex, suggestions.length - 1)]!);
                      else void send();
                    }
                  }}
                  placeholder="Enter para enviar · Shift+Enter para salto de línea…"
                  aria-describedby="discord-message-count"
                />

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
              <div className="discord-composer-toolbar">
                <div
                  className="discord-tools-group"
                  role="group"
                  aria-label="Adjuntos y herramientas"
                >
                  <input
                    type="file"
                    className="chat-file-input"
                    ref={fileRef}
                    aria-label="Adjuntar imagen o GIF"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={sending || !canAttach}
                    onChange={(event) => void attachFile(event.target.files?.[0])}
                  />
                  <button
                    type="button"
                    className="button outline small"
                    disabled={sending || !canAttach}
                    aria-label="Adjuntar archivo de imagen o GIF"
                    onClick={() => fileRef.current?.click()}
                  >
                    📎 Adjuntar archivo
                  </button>
                  <button
                    type="button"
                    className="button outline small"
                    disabled={sending || !canAttach}
                    aria-label="Seleccionar archivo de la bóveda"
                    onClick={() => setVaultPicker(true)}
                  >
                    💾 Bóveda
                  </button>
                  <button
                    type="button"
                    className="button outline small"
                    disabled={sending || !canAttach}
                    aria-label="Pegar URL de imagen o GIF"
                    aria-expanded={urlOpen}
                    onClick={() => setUrlOpen((open) => !open)}
                  >
                    🔗 Pegar URL
                  </button>

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
                    @ Mencionar
                  </button>
                  <button
                    type="button"
                    className="button outline small discord-compose-tool"
                    disabled={sending}
                    aria-label="Compartir juego del catálogo"
                    aria-expanded={gamePicker}
                    onClick={() => setGamePicker((open) => !open)}
                  >
                    🎮 Juego
                  </button>
                </div>
                <div
                  className="discord-emoji-palette"
                  role="group"
                  aria-label="Insertar emoji gamer"
                >
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
                <div className="discord-send-action">
                  <span id="discord-message-count" className="muted discord-char-counter">
                    {content.length}/500
                  </span>{' '}
                  <button
                    className="button discord-send-button"
                    aria-label={sending ? 'Enviando mensaje' : cooldown > 0 ? `Espera ${cooldown} segundos para enviar` : 'Enviar mensaje'}
                    aria-busy={sending}
                    disabled={
                      !node.online ||
                      loading ||
                      sending ||
                      cooldown > 0 ||
                      (!content.trim() && !attachment) ||
                      Boolean(attachment && !canAttach)
                    }
                  >
                    {sending ? 'Enviando…' : cooldown > 0 ? `Espera ${cooldown}s…` : 'ENVIAR ↗'}
                  </button>
                </div>
              </div>
            </form>
            <p className="muted discord-composer-note">
              Lo que envíes se publicará en el canal de Discord con tu nombre de usuario de
              SaveState.
            </p>
          </div>
        ) : (
          <p className="notice discord-readonly">
            [ MODO LECTURA //{' '}
            {frequency === 'chat-privado'
              ? 'FRECUENCIA PRIVADA'
              : frequency === 'checkpoints'
                ? 'REGISTRO DE CHECKPOINTS'
                : 'ANUNCIOS DESTACADOS'}{' '}
            ]
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
                ['chat-privado', '#〘🕵〙chat-privado', 'Frecuencia privada · envío habilitado'],
                ['announcements', '#📢-anuncios-savestate', 'Anuncios del servidor · modo lectura'],
              ] as const
            )
              .filter(([value]) => value !== 'chat-privado' || privateChatAccess.canRead)
              .map(([value, label, description]) => (
                <li key={value}>
                  <button
                    type="button"
                    className={`discord-channel-pill${frequency === value ? ' active' : ''}`}
                    aria-label={`Abrir ${label}`}
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
              UNIRSE AL SERVIDOR ↗
            </a>
          ) : (
            <p className="muted">Invitación pendiente de configuración.</p>
          )}
        </section>
        <section className="panel discord-presence" aria-labelledby="discord-presence-heading">
          <h2 id="discord-presence-heading">MIEMBROS EN LÍNEA</h2>
          <p className="discord-presence-count" role="status">
            {loading ? 'Consultando presencia…' : `🟢 ${presence.onlineCount} conectados`}
          </p>
          <div
            className="discord-presence-scroll"
            role="region"
            aria-label="Lista de miembros conectados"
            tabIndex={0}
          >
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
          </div>
          {!loading && !presence.members.length ? (
            <p className="muted">Sin miembros visibles en el widget.</p>
          ) : null}
        </section>
        <DiscordLinkedRoleCard />
      </aside>
    </div>
  );
}
