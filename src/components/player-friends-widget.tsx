'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client-api';
import { useOnlineUsers } from '@/lib/presence';
import { friendLevelTier } from '@/domain/player-friends';
import type { FriendProfile, FriendRequest, PlayerFriend } from '@/domain/player-friends';
import { FriendChatDrawer } from '@/components/friend-chat-drawer';

function FriendIdentity({ profile, isOnline }: { profile: FriendProfile; isOnline: boolean }) {
  return (
    <Link className="friend-identity" href={`/players/${profile.username}`}>
      <span className="friend-avatar">
        {profile.avatar_url ? (
          <Image src={profile.avatar_url} alt="" width={36} height={36} unoptimized />
        ) : (
          <span aria-hidden="true">▣</span>
        )}
      </span>
      <span className="friend-copy">
        <strong>@{profile.username}</strong>
        <span className={`friend-presence ${isOnline ? 'is-online' : 'is-offline'}`}>
          <span className="friend-presence-dot" aria-hidden="true" />
          {isOnline ? 'Activo' : 'Inactivo'}
        </span>
      </span>
    </Link>
  );
}

export function PlayerFriendsWidget({
  friends,
  receivedRequests = [],
  sentRequests = [],
  isOwner,
  available = true,
  currentUserId,
}: {
  friends: PlayerFriend[];
  receivedRequests?: FriendRequest[];
  sentRequests?: FriendRequest[];
  isOwner: boolean;
  available?: boolean;
  currentUserId?: string | null;
}) {
  const [tab, setTab] = useState<'friends' | 'received' | 'sent'>('friends');
  const [activeChatFriend, setActiveChatFriend] = useState<FriendProfile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const locked = useRef(false);
  const router = useRouter();
  const onlineUsers = useOnlineUsers();
  const requests = tab === 'received' ? receivedRequests : sentRequests;

  async function mutate(id: string, status?: 'accepted' | 'rejected') {
    if (locked.current || refreshing) return;
    locked.current = true;
    setBusyId(id);
    setMessage('');
    try {
      await api('social', status ? { action: 'respond', id, status } : { action: 'remove', id });
      setError(false);
      setMessage(
        status === 'accepted'
          ? 'Amistad aceptada.'
          : status === 'rejected'
            ? 'Solicitud rechazada.'
            : 'Solicitud cancelada.',
      );
      startTransition(() => router.refresh());
    } catch (failure) {
      setError(true);
      setMessage(
        failure instanceof Error ? failure.message : 'No se pudo actualizar la solicitud.',
      );
    } finally {
      locked.current = false;
      setBusyId(null);
    }
  }

  return (
    <section className="panel player-friends-widget" aria-labelledby="player-friends-heading">
      <h2 id="player-friends-heading">
        <Image src="/icons/halloween/fantasma.png" alt="" width={18} height={18} unoptimized />
        Amigos{' '}
        <span className="accent text-halloween-orange">{available ? friends.length : '—'}</span>
      </h2>
      {isOwner ? (
        <div className="filter-buttons friend-tabs" aria-label="Amigos y solicitudes">
          <button type="button" aria-pressed={tab === 'friends'} onClick={() => setTab('friends')}>
            Amigos ({friends.length})
          </button>
          <button
            type="button"
            aria-pressed={tab === 'received'}
            onClick={() => setTab('received')}
          >
            Solicitudes recibidas ({receivedRequests.length})
          </button>
          <button type="button" aria-pressed={tab === 'sent'} onClick={() => setTab('sent')}>
            Solicitudes enviadas ({sentRequests.length})
          </button>
        </div>
      ) : null}
      {tab === 'friends' || !isOwner ? (
        !available ? (
          <p className="notice">
            La lista de amigos estará disponible al aplicar la migración 020.
          </p>
        ) : friends.length ? (
          <ul className="friend-list">
            {friends.map((friend) => (
              <li key={friend.id} className="friend-row">
                <FriendIdentity profile={friend} isOnline={onlineUsers.has(friend.id)} />
                <div className="friend-row-actions">
                  {isOwner && currentUserId && (
                    <button
                      type="button"
                      className="button outline small friend-chat-btn"
                      onClick={() => setActiveChatFriend(friend)}
                    >
                      💬 Chat
                    </button>
                  )}
                  <span
                    className={`friend-level-circle friend-level-${friendLevelTier(friend.level)}`}
                    aria-label={`Nivel ${friend.level}`}
                  >
                    {friend.level}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Todavía no hay amistades aceptadas.</p>
        )
      ) : requests.length ? (
        <ul className="friend-list">
          {requests.map((request) => (
            <li key={request.id} className="friend-row friend-row-request">
              <FriendIdentity
                profile={request.profile}
                isOnline={onlineUsers.has(request.profile.id)}
              />
              <div className="friend-row-actions">
                <div className="friend-request-actions">
                  {tab === 'received' ? (
                    <>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={busyId !== null || refreshing}
                        onClick={() => void mutate(request.id, 'accepted')}
                      >
                        Aceptar
                      </button>
                      <button
                        type="button"
                        className="button danger"
                        disabled={busyId !== null || refreshing}
                        onClick={() => void mutate(request.id, 'rejected')}
                      >
                        Rechazar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busyId !== null || refreshing}
                      onClick={() => void mutate(request.id)}
                    >
                      Cancelar solicitud
                    </button>
                  )}
                  {busyId === request.id ? <span role="status">Procesando…</span> : null}
                </div>
                <span
                  className={`friend-level-circle friend-level-${friendLevelTier(request.profile.level)}`}
                  aria-label={`Nivel ${request.profile.level}`}
                >
                  {request.profile.level}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          No hay solicitudes {tab === 'received' ? 'recibidas' : 'enviadas'} pendientes.
        </p>
      )}
      {message ? (
        <p role={error ? 'alert' : 'status'} className={error ? 'error-text' : 'muted'}>
          {message}
        </p>
      ) : null}
      {activeChatFriend && isOwner && currentUserId && (
        <FriendChatDrawer
          key={activeChatFriend.id}
          currentUserId={currentUserId}
          friend={activeChatFriend}
          isOnline={onlineUsers.has(activeChatFriend.id)}
          onClose={() => setActiveChatFriend(null)}
        />
      )}
    </section>
  );
}
