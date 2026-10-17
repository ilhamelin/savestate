'use client';
import Link from 'next/link';
import { RotateCcw, Compass, AlertTriangle } from 'lucide-react';
import { soundFx } from '@/lib/sound';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="empty-state checkpoint-error" role="alert">
      <span className="checkpoint-error-icon">
        <AlertTriangle size={32} aria-hidden="true" />
      </span>
      <p className="eyebrow">ERROR CRÍTICO // CHECKPOINT CORRUPT</p>
      <h1>Se ha interrumpido la señal de la partida.</h1>
      <p className="muted checkpoint-error-description">
        El checkpoint no pudo cargarse debido a un fallo inesperado de sincronización.
        {error.digest ? ` Código de error: [${error.digest}]` : ''}
      </p>
      <div className="checkpoint-error-actions">
        <button
          type="button"
          className="button"
          onClick={() => {
            soundFx.click();
            reset();
          }}
        >
          <RotateCcw size={16} aria-hidden="true" />
          Reintentar sincronización
        </button>
        <Link href="/explore" className="button outline">
          <Compass size={16} aria-hidden="true" />
          Regresar a zona segura
        </Link>
      </div>
    </div>
  );
}
