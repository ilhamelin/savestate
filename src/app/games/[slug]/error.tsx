'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { reportClientError } from '@/lib/client-error-report';

export interface GameSegmentErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}
export default function GameSegmentError({ error, reset, retry }: GameSegmentErrorProps) {
  useEffect(() => {
    try { reportClientError(error, window.location.pathname); } catch { /* Recovery must stay available. */ }
  }, [error]);
  return (
    <section className="panel checkpoint-error" role="alert" style={{
      background: 'linear-gradient(135deg, #101a2be8, #080e18ed)',
      backdropFilter: 'blur(12px)', border: '1px solid #67e8f966', borderRadius: 12, padding: '2rem',
    }}>
      <p className="eyebrow">SEÑAL DEL JUEGO INTERRUMPIDA // RECONEXIÓN</p>
      <h1>La ficha necesita reconectarse.</h1>
      <p className="muted checkpoint-error-description">
        No se pudieron cargar todos los datos de esta ficha técnica. Puedes reintentar la conexión o volver al catálogo.
      </p>
      {error.digest && <p className="muted">Código de error: [{error.digest}]</p>}
      <div className="checkpoint-error-actions">
        <button type="button" className="button" onClick={() => (retry ?? reset)()}>Reintentar sincronización</button>
        <Link href="/explore" className="button outline">Regresar al catálogo</Link>
      </div>
    </section>
  );
}
