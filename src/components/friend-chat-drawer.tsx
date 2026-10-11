'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { FriendProfile } from '@/domain/player-friends';
import { mergeMessages, type FriendMessage } from '@/domain/friend-chat';
import { browserClient } from '@/integrations/supabase/browser';
import { api } from '@/lib/client-api';
import { readJsonResponse } from '@/lib/api-response';
export function FriendChatDrawer({
  currentUserId,
  friend,
  isOnline,
  onClose,
}: {
  currentUserId: string;
  friend: FriendProfile;
  isOnline: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    async function refresh() {
      if (loading || controller.signal.aborted) return;
      loading = true;
      try {
        const response = await fetch(`/api/chat?friendId=${encodeURIComponent(friend.id)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const result = await readJsonResponse<{
          data: { messages: FriendMessage[]; persisted: boolean };
        }>(response);
        if (!controller.signal.aborted) {
          setMessages((old) => {
            const merged = mergeMessages(old, result.data.messages);
            return JSON.stringify(old) === JSON.stringify(merged) ? old : merged;
          });
          setPersisted(result.data.persisted);
          setError('');
        }
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'No se pudo cargar el chat.');
      } finally {
        loading = false;
      }
    }
    void refresh();
    const db = browserClient();
    // Broadcast contains only a refresh hint: content and sender are always read through RLS.
    const channel = db
      .channel(`savestate:dm:${[currentUserId, friend.id].sort().join(':')}`, {
        config: { private: true },
      })
      .on('broadcast', { event: 'dm' }, () => void refresh())
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_messages',
          filter: `receiver_id=eq.${currentUserId}`,
        },
        () => void refresh(),
      );
    channelRef.current = channel;
    void db.realtime
      .setAuth()
      .then(() => {
        if (!controller.signal.aborted)
          channel.subscribe((status) => {
            if (!controller.signal.aborted) {
              setConnected(status === 'SUBSCRIBED');
              if (status === 'SUBSCRIBED') void refresh();
            }
          });
      })
      .catch(() => {
        if (!controller.signal.aborted) setConnected(false);
      });
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 10000);
    return () => {
      controller.abort();
      clearInterval(timer);
      channelRef.current = null;
      void db.removeChannel(channel);
    };
  }, [currentUserId, friend.id]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  }, [messages]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (locked.current || !persisted || !content.trim()) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await api<{ message: FriendMessage; persisted: boolean }>('chat', {
        friendId: friend.id,
        content,
      });
      setMessages((old) => mergeMessages(old, [data.message]));
      setContent('');
      await channelRef.current?.send({
        type: 'broadcast',
        event: 'dm',
        payload: { id: data.message.id },
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo enviar.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="panel friend-chat-drawer" aria-label={`Chat con ${friend.username}`}>
      <header>
        <strong>@{friend.username}</strong>
        <span className={isOnline ? 'accent' : 'muted'}>
          {isOnline ? '● Activo' : '○ Inactivo'}
        </span>
        <button
          type="button"
          className="button outline small"
          aria-label="Cerrar chat"
          onClick={onClose}
        >
          ✕
        </button>
      </header>
      <p className="muted">
        {connected ? 'Canal privado conectado' : 'Actualizando cada 10 segundos'}
      </p>
      <div className="friend-chat-messages" role="log" aria-live="polite">
        {messages.map((message) => (
          <article key={message.id} className={message.sender_id === currentUserId ? 'dm-own' : ''}>
            <strong>{message.sender_id === currentUserId ? 'Tú' : friend.username}</strong>
            <p>{message.content}</p>
            <time dateTime={message.created_at}>
              {new Date(message.created_at).toLocaleTimeString('es-CL', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </article>
        ))}
        <div ref={endRef} />
      </div>
      {persisted === false && (
        <p className="notice">El chat estará disponible al aplicar la migración 026.</p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <form onSubmit={send}>
        <label className="sr-only" htmlFor="friend-chat-input">
          Mensaje para {friend.username}
        </label>
        <input
          id="friend-chat-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
          disabled={!persisted || busy}
          placeholder="Escribe un mensaje…"
        />
        <button className="button" disabled={!persisted || busy || !content.trim()}>
          Enviar
        </button>
      </form>
    </section>
  );
}
