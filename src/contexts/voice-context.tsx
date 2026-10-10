'use client';
import dynamic from 'next/dynamic';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Room } from 'livekit-client';
import {
  voiceChannel,
  voiceMicEnabled,
  voiceShortcutTarget,
  type VoiceChannel,
  type VoiceMode,
} from '@/domain/voice';
import { readJsonResponse } from '@/lib/api-response';
import { browserClient } from '@/integrations/supabase/browser';
import { isConfigured } from '@/lib/env';

const VoiceAudio = dynamic(
  () => import('@/components/voice-audio').then((module) => module.VoiceAudio),
  { ssr: false },
);
interface VoiceContextValue {
  room: Room | null;
  activeChannel: VoiceChannel | null;
  connecting: boolean;
  reconnecting: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  mode: VoiceMode;
  held: boolean;
  audioBlocked: boolean;
  error: string;
  connect: (channelId: string) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  setMode: (mode: VoiceMode) => void;
  setHeld: (held: boolean) => void;
  startAudio: () => void;
}
const VoiceContext = createContext<VoiceContextValue | null>(null);
function releaseRoom(room: Room | null) {
  if (!room) return;
  for (const publication of room.localParticipant.audioTrackPublications.values())
    publication.track?.stop();
  void room.disconnect(true).catch(() => {
    /* Tracks are stopped even if transport cleanup fails. */
  });
}
export function VoiceProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [activeChannel, setActiveChannel] = useState<VoiceChannel | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [isMuted, setMuted] = useState(true);
  const [isDeafened, setDeafened] = useState(false);
  const [mode, changeMode] = useState<VoiceMode>('continuous');
  const [held, setHeld] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [error, setError] = useState('');
  const roomRef = useRef<Room | null>(null);
  const generation = useRef(0);
  const tokenRequest = useRef<AbortController | null>(null);
  const microphoneQueue = useRef<Promise<void>>(Promise.resolve());
  const desiredMic = useRef(false);
  const disconnect = useCallback(() => {
    generation.current++;
    tokenRequest.current?.abort();
    tokenRequest.current = null;
    const current = roomRef.current;
    roomRef.current = null;
    desiredMic.current = false;
    releaseRoom(current);
    setRoom(null);
    setActiveChannel(null);
    setConnecting(false);
    setReconnecting(false);
    setMuted(true);
    setDeafened(false);
    setHeld(false);
    setAudioBlocked(false);
  }, []);
  const connect = useCallback(
    async (channelId: string) => {
      disconnect();
      const channel = voiceChannel(channelId);
      const attempt = generation.current;
      const controller = new AbortController();
      tokenRequest.current = controller;
      setConnecting(true);
      setError('');
      let next: Room | undefined;
      let joining = false;
      try {
        if (!window.isSecureContext || !navigator.mediaDevices)
          throw new Error('La voz requiere HTTPS y un navegador compatible con micrófono.');
        const response = await fetch('/api/voice/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId }),
          signal: controller.signal,
          cache: 'no-store',
        });
        const data = await readJsonResponse<{ token: string; url: string }>(response);
        if (attempt !== generation.current) return;
        const { Room, RoomEvent, ConnectionState } = await import('livekit-client');
        if (attempt !== generation.current) return;
        next = new Room({
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const current = next;
        let joined = false;
        roomRef.current = current;
        current.on(RoomEvent.ConnectionStateChanged, (state) => {
          if (attempt === generation.current)
            setReconnecting(
              state === ConnectionState.Reconnecting ||
                state === ConnectionState.SignalReconnecting,
            );
        });
        current.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          if (attempt === generation.current) setAudioBlocked(!current.canPlaybackAudio);
        });
        current.on(RoomEvent.Disconnected, () => {
          if (joined && attempt === generation.current && roomRef.current === current) {
            disconnect();
            setError('La conexión de voz terminó. Puedes volver a sintonizar.');
          }
        });
        joining = true;
        await current.connect(data.url, data.token);
        if (attempt !== generation.current) {
          await current.disconnect(true);
          return;
        }
        joined = true;
        setRoom(current);
        setActiveChannel(channel);
        await current.startAudio().catch(() => {
          if (attempt === generation.current) setAudioBlocked(true);
        });
      } catch (failure) {
        await next?.disconnect(true);
        if (attempt === generation.current && !controller.signal.aborted) {
          disconnect();
          setError(
            joining
              ? 'No se pudo sintonizar. Comprueba tu conexión o prueba otra frecuencia si está llena.'
              : failure instanceof Error
                ? failure.message
                : 'No se pudo sintonizar.',
          );
        }
      } finally {
        if (attempt === generation.current) {
          setConnecting(false);
          tokenRequest.current = null;
        }
      }
    },
    [disconnect],
  );
  useEffect(() => {
    const wanted = voiceMicEnabled(isMuted, isDeafened, mode, held);
    desiredMic.current = wanted;
    if (!room) return;
    microphoneQueue.current = microphoneQueue.current.then(async () => {
      if (roomRef.current !== room) return;
      try {
        await room.localParticipant.setMicrophoneEnabled(desiredMic.current);
        if (roomRef.current !== room) {
          await room.disconnect(true);
          return;
        }
        if (!desiredMic.current && room.localParticipant.isMicrophoneEnabled)
          await room.localParticipant.setMicrophoneEnabled(false);
      } catch {
        if (roomRef.current === room) {
          setMuted(true);
          setHeld(false);
          setError(
            'No se pudo activar el micrófono. Revisa el permiso del navegador y el dispositivo de entrada.',
          );
        }
      }
    });
  }, [room, isMuted, isDeafened, mode, held]);
  useEffect(() => {
    if (!room || mode !== 'push-to-talk' || isMuted || isDeafened) return;
    function down(event: KeyboardEvent) {
      if (
        event.code !== 'Space' ||
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        voiceShortcutTarget(event.target)
      )
        return;
      event.preventDefault();
      setHeld(true);
    }
    function up(event: KeyboardEvent) {
      if (event.code === 'Space') setHeld(false);
    }
    const release = () => setHeld(false);
    const visibility = () => {
      if (document.visibilityState !== 'visible') release();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [room, mode, isMuted, isDeafened]);
  useEffect(() => {
    if (!isConfigured()) return;
    const { data } = browserClient().auth.onAuthStateChange((event, session) => {
      const identity = roomRef.current?.localParticipant.identity;
      if (
        event === 'SIGNED_OUT' ||
        (event === 'SIGNED_IN' && identity && session?.user.id !== identity)
      )
        disconnect();
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [disconnect]);
  useEffect(
    () => () => {
      generation.current++;
      tokenRequest.current?.abort();
      releaseRoom(roomRef.current);
    },
    [],
  );
  useEffect(() => {
    if (!activeChannel) return;
    document.body.classList.add('voice-connected');
    return () => document.body.classList.remove('voice-connected');
  }, [activeChannel]);
  const startAudio = () => {
    void roomRef.current
      ?.startAudio()
      .then(() => setAudioBlocked(false))
      .catch(() =>
        setError('Pulsa Activar audio para permitir la reproducción en este navegador.'),
      );
  };
  return (
    <VoiceContext.Provider
      value={{
        room,
        activeChannel,
        connecting,
        reconnecting,
        isMuted,
        isDeafened,
        mode,
        held,
        audioBlocked,
        error,
        connect,
        disconnect,
        toggleMute: () => {
          setHeld(false);
          setMuted((value) => !value);
        },
        toggleDeafen: () => {
          setHeld(false);
          setDeafened((value) => !value);
        },
        setMode: (value) => {
          setHeld(false);
          changeMode(value);
        },
        setHeld,
        startAudio,
      }}
    >
      {children}
      {room ? <VoiceAudio room={room} muted={isDeafened} /> : null}
    </VoiceContext.Provider>
  );
}
export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) throw new Error('VoiceProvider requerido.');
  return context;
}
