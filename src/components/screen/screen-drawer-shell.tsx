'use client';
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
function subscribe(listener: () => void) {
  const media = window.matchMedia('(max-width: 900px)');
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
function snapshot() {
  return window.matchMedia('(max-width: 900px)').matches;
}
export function ScreenDrawerShell({
  children,
  title,
  openMobile,
  onClose,
}: {
  children: ReactNode;
  title: string;
  openMobile: boolean;
  onClose: () => void;
}) {
  const mobile = useSyncExternalStore(subscribe, snapshot, () => false),
    ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!mobile || !openMobile) return;
    const dialog = ref.current,
      overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, [mobile, openMobile]);
  if (mobile)
    return openMobile ? (
      <dialog
        ref={ref}
        className="screen-drawer screen-hud-card screen-mobile-drawer"
        aria-label={`Telemetría de ${title}`}
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        {children}
      </dialog>
    ) : null;
  return (
    <aside className="screen-drawer screen-hud-card" aria-label={`Telemetría de ${title}`}>
      {children}
    </aside>
  );
}
