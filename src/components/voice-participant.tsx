'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useIsSpeaking } from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { useEffect, useState, type CSSProperties } from 'react';
import { voiceAvatar } from '@/domain/voice';

export function VoiceParticipant({ participant }: { participant: Participant }) {
  const speaking = useIsSpeaking(participant);
  const [level, setLevel] = useState(0);
  const avatar = voiceAvatar(participant.metadata, process.env.NEXT_PUBLIC_SUPABASE_URL);
  useEffect(() => {
    if (!speaking || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setLevel(participant.audioLevel), 120);
    return () => clearInterval(timer);
  }, [participant, speaking]);
  const name = participant.name || 'Jugador';
  return (
    <article className={`voice-participant${speaking ? ' voice-speaking' : ''}`}>
      <div className="voice-avatar">
        {avatar ? (
          <Image src={avatar} width={64} height={64} alt="" unoptimized />
        ) : (
          <span aria-hidden="true">👾</span>
        )}
      </div>
      <Link href={`/players/${encodeURIComponent(name)}`}>@{name}</Link>
      <span className="muted">
        {participant.isLocal ? 'Tú · ' : ''}
        {participant.isMicrophoneEnabled
          ? speaking
            ? 'Transmitiendo'
            : 'Escuchando'
          : 'Micrófono silenciado'}
      </span>
      <div
        className="vumeter-bars"
        aria-hidden="true"
        style={{ '--voice-level': speaking ? Math.max(0.2, level) : 0.1 } as CSSProperties}
      >
        <i className="vumeter-bar" />
        <i className="vumeter-bar" />
        <i className="vumeter-bar" />
        <i className="vumeter-bar" />
        <i className="vumeter-bar" />
      </div>
    </article>
  );
}
