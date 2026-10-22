'use client';
import { useRef, useState } from 'react';
import type { MemoryCardData } from '@/lib/memory-card-export';
import { RetroCard3D } from '@/components/retro-card-3d';
export function MemoryCardExport({ data }: { data: MemoryCardData }) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState('');
  const busy = useRef(false);
  return (
    <section className="panel memory-card" aria-label="SaveState Memory Card">
      <p className="eyebrow">SAVESTATE MEMORY CARD // PLAYER SAVE</p>
      <h2>Tu tarjeta gamer · @{data.profile.username}</h2>
      <p className="muted">Tu identidad, hardware y Top 4 en una tarjeta PNG de 1080 × 1350 px.</p>
      <RetroCard3D username={data.profile.username} avatarUrl={data.profile.avatar_url}
        terminalStatus={data.profile.terminal_status ?? undefined} clearRate={data.clearRate} hours={data.hours}
        topGames={data.favorites.map((game) => ({ id: game.id, title: game.title, coverUrl: game.cover_url }))}
        qrCode={data.qrCode}>
        {(skin) => <button className="button" type="button" disabled={pending}
          onClick={async () => {
            if (busy.current) return;
            busy.current = true;
            setPending(true);
            setMessage('');
            try {
              const { renderMemoryCard, downloadMemoryCard } = await import('@/lib/memory-card-export');
              const result = await renderMemoryCard(data, skin);
              downloadMemoryCard(result.blob, data.profile.username, skin);
              setMessage(result.missingImages
                ? 'Memory Card descargada. Las imágenes no disponibles se reemplazaron por bloques retro.'
                : 'Memory Card descargada.');
            } catch (failure) {
              setMessage(failure instanceof Error ? failure.message : 'No se pudo exportar la tarjeta.');
            } finally { busy.current = false; setPending(false); }
          }}>
          {pending ? 'Generando Memory Card…' : '💾 Descargar Memory Card (PNG)'}
        </button>}
      </RetroCard3D>
      <p role="status">{message}</p>
    </section>
  );
}
