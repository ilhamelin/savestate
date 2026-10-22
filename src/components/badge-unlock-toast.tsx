'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { BadgeUnlockEvent } from '@/domain/badges';
import { BadgePixelIcon } from '@/components/badge-pixel-icon';

export const BADGE_TOAST_DURATION_MS = 6000;
export function BadgeUnlockToast({
  event,
  onClose,
}: {
  event: BadgeUnlockEvent;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, BADGE_TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onClose]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <aside className="badge-unlock-toast" role="status" aria-live="polite" aria-atomic="true">
      <BadgePixelIcon icon={event.iconPixel} size={44} />
      <div className="badge-unlock-copy">
        <p className="eyebrow">¡LOGRO DESBLOQUEADO!</p>
        <strong>{event.badgeName}</strong>
        <p>{event.badgeDescription}</p>
      </div>
      <button
        type="button"
        className="button outline small"
        onClick={onClose}
        aria-label={`Cerrar aviso de logro: ${event.badgeName}`}
      >
        ✕
      </button>
    </aside>,
    document.body,
  );
}
