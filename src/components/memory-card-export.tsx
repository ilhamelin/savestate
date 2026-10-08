'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import {
  downloadMemoryCard,
  renderMemoryCard,
  type MemoryCardData,
} from '@/lib/memory-card-export';
export function MemoryCardExport({ data }: { data: MemoryCardData }) {
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState('');
  const busy = useRef(false);
  return (
    <section className="panel memory-card" aria-label="SaveState Memory Card">
      <p className="eyebrow">SAVESTATE MEMORY CARD // 15 BLOCKS</p>
      <div className="memory-card-heading">
        <div className="avatar">
          {data.profile.avatar_url ? (
            <Image
              src={data.profile.avatar_url}
              alt={`Avatar de ${data.profile.username}`}
              fill
              sizes="80px"
              unoptimized
            />
          ) : (
            <span aria-hidden="true">▣</span>
          )}
        </div>
        <div>
          <h2>@{data.profile.username}</h2>
          <p>
            {data.clearRate.toFixed(1)}% Clear Rate · {data.hours.toFixed(1)} h
          </p>
        </div>
      </div>
      <p className="muted">Tu identidad, hardware y Top 4 en una tarjeta PNG de 1080 × 1350 px.</p>
      <button
        className="button"
        type="button"
        disabled={pending}
        onClick={async () => {
          if (busy.current) return;
          busy.current = true;
          setPending(true);
          setMessage('');
          try {
            const result = await renderMemoryCard(data);
            downloadMemoryCard(result.blob, data.profile.username);
            setMessage(
              result.missingImages
                ? 'Memory Card descargada. Las imágenes no disponibles se reemplazaron por bloques retro.'
                : 'Memory Card descargada.',
            );
          } catch (failure) {
            setMessage(
              failure instanceof Error ? failure.message : 'No se pudo exportar la tarjeta.',
            );
          } finally {
            busy.current = false;
            setPending(false);
          }
        }}
      >
        {pending ? 'Generando Memory Card…' : '💾 Descargar Memory Card (PNG)'}
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
