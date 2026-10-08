'use client';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { browserClient } from '@/integrations/supabase/browser';
import { api } from '@/lib/client-api';
import { readJsonResponse } from '@/lib/api-response';
import {
  NOTIFICATION_LABELS,
  notificationAge,
  type NotificationSummary,
} from '@/domain/notifications';

export function NotificationBell({ userId }: { userId: string }) {
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false);
  const [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null),
    id = useId();
  const pathname = usePathname(),
    router = useRouter();
  useEffect(() => {
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
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
        if (!disposed && !requestController.signal.aborted) {
          setSummary(result.data);
          setError('');
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
    const db = browserClient();
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
        schedule,
      )
      .subscribe();
    const poll = setInterval(visible, 60000);
    document.addEventListener('visibilitychange', visible);
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', visible);
      void db.removeChannel(channel);
    };
  }, [userId, id, pathname, revision]);
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
  const count = summary?.unreadCount ?? 0;
  return (
    <div
      className="notification-bell"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
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
                  item.forumHref ??
                  (item.username
                    ? `/players/${item.username}${item.kind === 'badge_unlocked' ? '#player-badges' : ''}`
                    : '/notifications')
                }
                onClick={() => setOpen(false)}
              >
                @{item.username ?? 'jugador'} {NOTIFICATION_LABELS[item.kind] ?? 'envió una señal'}
                {item.badgeName ? `: ${item.badgeName}` : ''}
              </Link>
              <time dateTime={item.created_at}>
                {notificationAge(item.created_at, summary.generatedAt)}
              </time>
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
            disabled={pending || !count}
            onClick={markAll}
          >
            {pending ? 'Marcando…' : 'Marcar todas como leídas'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
