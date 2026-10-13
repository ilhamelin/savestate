'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export function ScreenTrailerModal({
  videoId,
  title,
  onClose,
}: {
  videoId: string;
  title: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
  return (
    <dialog
      ref={ref}
      className="screen-trailer-modal"
      aria-label={`Tráiler de ${title}`}
      onCancel={(event) => {
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <div className="screen-trailer-heading">
        <h2>{title} · Tráiler</h2>
        <button type="button" className="button outline small" onClick={onClose}>
          <X size={14} /> Cerrar
        </button>
      </div>
      <iframe
        title={`Tráiler de ${title}`}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </dialog>
  );
}
