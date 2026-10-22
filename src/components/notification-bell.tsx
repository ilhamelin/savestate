'use client';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { BadgeUnlockToast } from '@/components/badge-unlock-toast';
import {
  badgeUnlockNotification,
  badgeUnlockEvent,
  type BadgeUnlockNotification,
  type BadgeUnlockEvent,
} from '@/domain/badges';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/integrations/supabase/browser';
import { useOnlineUsers } from '@/lib/presence';
import { api } from '@/lib/client-api';
import { readJsonResponse } from '@/lib/api-response';
import {
  NOTIFICATION_LABELS,
  notificationAge,
  type NotificationSummary,
} from '@/domain/notifications';

export function NotificationBell({ userId }: { userId: string }) {
  useOnlineUsers(userId);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false);
  const [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null),
    id = useId();
  const responding = useRef(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const router = useRouter();
  const [badgeUnlocks, setBadgeUnlocks] = useState<{ id: string; event: BadgeUnlockEvent }[]>([]);
  const pendingBadges = useRef(new Map<string, BadgeUnlockNotification>());
  const seenBadges = useRef(new Set<string>());
  const badgeBaseline = useRef<string | null>(null);
  const dismissBadge = useCallback(() => setBadgeUnlocks((queue) => queue.slice(1)), []);
  useEffect(() => {
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const db = browserClient();
    const badgeController = new AbortController();
    let flushingBadges = false;
    async function flushBadges() {
      if (flushingBadges || disposed || !pendingBadges.current.size) return;
      flushingBadges = true;
      const notices = [...pendingBadges.current.values()]
        .slice(0, 50)
        .sort((a, b) => Date.parse(a.unlockedAt) - Date.parse(b.unlockedAt));
      let completed = false;
      try {
        const result = await db
          .from('badges')
          .select('id,name,description,category,icon_pixel,created_at')
          .in('id', [...new Set(notices.map((notice) => notice.badgeId))])
          .abortSignal(AbortSignal.any([badgeController.signal, AbortSignal.timeout(5000)]));
        if (disposed || result.error) return;
        const events: { id: string; event: BadgeUnlockEvent }[] = [];
        for (const notice of notices) {
          pendingBadges.current.delete(notice.id);
          if (seenBadges.current.has(notice.id)) continue;
          const badge = result.data?.find((value) => value.id === notice.badgeId);
          const event = badge ? badgeUnlockEvent(notice, badge) : null;
          seenBadges.current.add(notice.id);
          if (event) events.push({ id: notice.id, event });
        }
        if (events.length) setBadgeUnlocks((queue) => [...queue, ...events]);
        completed = true;
      } catch {
        // Keep pending IDs for the next successful refresh; never invent a badge.
      } finally {
        flushingBadges = false;
        if (completed && !disposed && pendingBadges.current.size) schedule();
      }
    }
    async function refresh() {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      try {
        const response = await fetch('/api/notifications', {
          signal: requestController.signal,
          cache: 'no-store',
        });
        const result = await readJsonResponse<{ data: NotificationSummary }>(response);
        if (!disposed && !requestController.signal.aborted && !responding.current) {
          setSummary(result.data);
          setError('');
          // Establish a server-clock baseline without replaying historical unlocks.
          const since = badgeBaseline.current;
          badgeBaseline.current ??= result.data.generatedAt;
          for (const item of since ? result.data.items : []) {
            if (item.read_at || Date.parse(item.created_at) < Date.parse(since!)) continue;
            const notice = badgeUnlockNotification(
              { ...item, user_id: userId, badge_id: item.badgeId },
              userId,
            );
            if (notice && !seenBadges.current.has(notice.id))
              pendingBadges.current.set(notice.id, notice);
          }
          await flushBadges();
        }
      } catch (failure) {
        if (!disposed && !(failure instanceof Error && failure.name === 'AbortError'))
          setError('No se pudieron actualizar las señales.');
      }
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 250);
    }
    function visible() {
      if (document.visibilityState === 'visible') schedule();
    }
    void refresh();
    const channel = db
      .channel(`notifications:${userId}:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const notice = badgeUnlockNotification(payload.new, userId);
            if (notice && !seenBadges.current.has(notice.id))
              pendingBadges.current.set(notice.id, notice);
          }
          schedule();
        },
      )
      .subscribe();
    const poll = setInterval(visible, 60000);
    document.addEventListener('visibilitychange', visible);
    return () => {
      disposed = true;
      controller?.abort();
      badgeController.abort();
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', visible);
      void db.removeChannel(channel);
    };
  }, [userId, id, revision]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('a,button')?.focus();
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  async function markAll() {
    setPending(true);
    try {
      await api('community', { action: 'read_all_notifications' });
      setRevision((n) => n + 1);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudieron marcar las señales.');
    } finally {
      setPending(false);
    }
  }
  async function respond(
    item: NotificationSummary['items'][number],
    status: 'accepted' | 'rejected',
  ) {
    if (!item.friendshipId || responding.current) return;
    responding.current = true;
    setResponseId(item.id);
    setError('');
    try {
      await api('social', { action: 'respond', id: item.friendshipId, status });
      setSummary((current) =>
        current
          ? {
              ...current,
              items: current.items.map((notification) =>
                notification.friendshipId === item.friendshipId
                  ? { ...notification, friendshipId: null }
                  : notification,
              ),
            }
          : current,
      );
      try {
        await api('community', { action: 'read_notification', id: item.id });
        setSummary((current) =>
          current
            ? {
                ...current,
                unreadCount: Math.max(
                  0,
                  current.unreadCount -
                    (current.items.some(
                      (notification) => notification.id === item.id && !notification.read_at,
                    )
                      ? 1
                      : 0),
                ),
                items: current.items.map((notification) =>
                  notification.id === item.id
                    ? { ...notification, read_at: new Date().toISOString() }
                    : notification,
                ),
              }
            : current,
        );
      } catch {
        setError('Solicitud respondida; no se pudo marcar la señal como leída.');
      }
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo responder la solicitud.');
    } finally {
      responding.current = false;
      setResponseId(null);
      setRevision((n) => n + 1);
    }
  }
  const count = summary?.unreadCount ?? 0;
  return (
    <div
      className="notification-bell"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {badgeUnlocks[0] ? (
        <BadgeUnlockToast
          key={badgeUnlocks[0].id}
          event={badgeUnlocks[0].event}
          onClose={dismissBadge}
        />
      ) : null}
      <button
        type="button"
        className="notification-trigger"
        ref={trigger}
        aria-label={`Notificaciones${summary ? `, ${count} sin leer` : ''}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) setRevision((n) => n + 1);
        }}
      >
        <Bell size={18} aria-hidden="true" />
        {count > 0 ? (
          <span className="notification-badge" aria-hidden="true">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={id}
          ref={panel}
          className="notification-popover panel"
          role="region"
          aria-label="Últimas señales"
        >
          <p className="eyebrow">INCOMING SIGNALS · {count} sin leer</p>
          {!summary ? <p role="status">Cargando señales…</p> : null}
          {summary?.items.map((item) => (
            <div key={item.id} className={`notification-item ${item.read_at ? '' : 'unread'}`}>
              <Link
                href={
                  item.trackerHref ??
                  item.forumHref ??
                  (item.username
                    ? `/players/${item.username}${item.kind === 'badge_unlocked' ? '#player-badges' : ''}`
                    : '/notifications')
                }
                onClick={() => setOpen(false)}
              >
                @{item.username ?? 'jugador'} {NOTIFICATION_LABELS[item.kind] ?? 'envió una señal'}
                {item.badgeName ? `: ${item.badgeName}` : ''}
                {item.trackerTitle ? `: ${item.trackerTitle}` : ''}
              </Link>
              <time dateTime={item.created_at}>
                {notificationAge(item.created_at, summary.generatedAt)}
              </time>
              {item.kind === 'friend_request' && item.friendshipId ? (
                <div className="filter-buttons">
                  <button
                    type="button"
                    className="button outline small"
                    disabled={responseId !== null || pending}
                    onClick={() => void respond(item, 'accepted')}
                  >
                    ✔ Aceptar
                  </button>
                  <button
                    type="button"
                    className="button outline small"
                    disabled={responseId !== null || pending}
                    onClick={() => void respond(item, 'rejected')}
                  >
                    ✖ Rechazar
                  </button>
                  {responseId === item.id ? <span role="status">Respondiendo…</span> : null}
                </div>
              ) : null}
            </div>
          ))}
          {summary && !summary.items.length ? (
            <p className="muted">No hay señales todavía.</p>
          ) : null}
          {error ? (
            <p role="alert" className="error-text">
              {error}
            </p>
          ) : null}
          <Link className="accent" href="/notifications" onClick={() => setOpen(false)}>
            Ver todas las señales →
          </Link>
          <button
            type="button"
            className="button outline small"
            disabled={pending || responseId !== null || !count}
            onClick={markAll}
          >
            {pending ? 'Marcando…' : 'Marcar todas como leídas'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
