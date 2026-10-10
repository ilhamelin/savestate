'use client';
import Link from 'next/link';
import { useVoice } from '@/contexts/voice-context';
export function VoiceDock() {
  const voice = useVoice();
  if (!voice.activeChannel) return null;
  return (
    <aside className="voice-dock" aria-label="Controles de la llamada de voz">
      <Link href="/community/voice" className="voice-dock-frequency">
        📻 {voice.activeChannel.name} | {voice.activeChannel.frequency}
        <small>
          {voice.reconnecting ? 'RECONECTANDO…' : 'SEÑAL ACTIVA'}
          {voice.mode === 'push-to-talk' ? ' · ESPACIO PARA HABLAR' : ''}
        </small>
      </Link>
      <div className="voice-dock-actions">
        <button
          type="button"
          className="button outline small"
          onClick={voice.toggleMute}
          aria-pressed={voice.isMuted}
          disabled={voice.reconnecting}
        >
          {voice.isMuted ? '🎙 Activar mic' : '🔇 Silenciar mic'}
        </button>
        <button
          type="button"
          className="button outline small"
          onClick={voice.toggleDeafen}
          aria-pressed={voice.isDeafened}
        >
          {voice.isDeafened ? '🔈 Escuchar' : '🎧 Ensordecer'}
        </button>
        {voice.audioBlocked ? (
          <button type="button" className="button small" onClick={voice.startAudio}>
            Activar audio
          </button>
        ) : null}
        <button type="button" className="button danger small" onClick={voice.disconnect}>
          Desconectar
        </button>
      </div>
      {voice.error ? (
        <p className="error-text" role="alert">
          {voice.error}
        </p>
      ) : null}
    </aside>
  );
}
