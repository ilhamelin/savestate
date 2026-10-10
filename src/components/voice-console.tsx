'use client';
import { useParticipants } from '@livekit/components-react';
import type { Room } from 'livekit-client';
import { DEFAULT_VOICE_CHANNELS } from '@/domain/voice';
import { useVoice } from '@/contexts/voice-context';
import { VoiceParticipant } from '@/components/voice-participant';

function Participants({ room }: { room: Room }) {
  const participants = useParticipants({ room });
  return (
    <>
      <p className="eyebrow">EN LA FRECUENCIA // {participants.length} JUGADORES</p>
      <div className="voice-participants-grid">
        {participants.map((participant) => (
          <VoiceParticipant key={participant.identity} participant={participant} />
        ))}
      </div>
    </>
  );
}
export function VoiceConsole({ configured }: { configured: boolean }) {
  const voice = useVoice();
  return (
    <section className="voice-console" aria-label="Sintonizador de Savestate Comms">
      <div className="voice-radio-display panel">
        <p className="eyebrow">SAVESTATE COMMS // RADIO MULTIJUGADOR</p>
        <h2>{voice.activeChannel ? voice.activeChannel.frequency : 'Sintoniza tu equipo.'}</h2>
        <p className="muted">
          {voice.connecting
            ? 'Sintonizando…'
            : voice.reconnecting
              ? 'Recuperando señal…'
              : voice.activeChannel
                ? `${voice.activeChannel.name} · La conexión continúa mientras navegas por SaveState.`
                : 'Tres frecuencias para encontrarte, coordinar partidas y conversar.'}
        </p>
        <p className="muted">
          Entras con el micrófono silenciado. Actívalo en el dock cuando quieras hablar.
        </p>
      </div>
      {!configured ? (
        <div className="panel" role="status">
          <h2>Frecuencias en espera.</h2>
          <p>
            Configura LIVEKIT_URL, LIVEKIT_API_KEY y LIVEKIT_API_SECRET en el servidor para activar
            Savestate Comms.
          </p>
        </div>
      ) : null}
      {voice.error ? (
        <p className="error-text" role="alert">
          {voice.error}
        </p>
      ) : null}
      <div className="voice-channels-grid">
        {DEFAULT_VOICE_CHANNELS.map((channel, index) => {
          const active = voice.activeChannel?.id === channel.id;
          return (
            <article className={`panel voice-channel${active ? ' active' : ''}`} key={channel.id}>
              <p className="eyebrow">
                📻 CH-0{index + 1} // {channel.frequency}
              </p>
              <h2>{channel.name}</h2>
              <p className="muted">{channel.description}</p>
              <p className="muted">Hasta {channel.maxParticipants} participantes</p>
              <button
                type="button"
                className={`button ${active ? 'danger' : 'outline'}`}
                disabled={!configured || voice.connecting}
                onClick={() => (active ? voice.disconnect() : void voice.connect(channel.id))}
              >
                {active
                  ? 'Desconectar'
                  : voice.connecting
                    ? 'Sintonizando…'
                    : 'Sintonizar frecuencia →'}
              </button>
            </article>
          );
        })}
      </div>
      {voice.connecting ? (
        <button type="button" className="button outline small" onClick={voice.disconnect}>
          Cancelar conexión
        </button>
      ) : null}
      {voice.room && voice.activeChannel ? (
        <section className="panel voice-session" aria-label="Jugadores y modo de transmisión">
          <div className="voice-mode-controls">
            <label>
              Modo de transmisión
              <select
                value={voice.mode}
                onChange={(event) =>
                  voice.setMode(
                    event.target.value === 'push-to-talk' ? 'push-to-talk' : 'continuous',
                  )
                }
              >
                <option value="continuous">Detección continua de voz</option>
                <option value="push-to-talk">Pulsar para hablar</option>
              </select>
            </label>
            {voice.mode === 'push-to-talk' ? (
              <button
                type="button"
                className={`button ${voice.held ? '' : 'outline'}`}
                disabled={voice.isMuted || voice.isDeafened || voice.reconnecting}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  voice.setHeld(true);
                }}
                onPointerUp={() => voice.setHeld(false)}
                onPointerCancel={() => voice.setHeld(false)}
                onLostPointerCapture={() => voice.setHeld(false)}
                onBlur={() => voice.setHeld(false)}
                onKeyDown={(event) => {
                  if (event.code === 'Space' || event.key === 'Enter') {
                    event.preventDefault();
                    voice.setHeld(true);
                  }
                }}
                onKeyUp={() => voice.setHeld(false)}
                aria-pressed={voice.held}
              >
                🎙 {voice.held ? 'Transmitiendo…' : 'Mantén pulsado para hablar'}
              </button>
            ) : null}
          </div>
          {voice.mode === 'push-to-talk' ? (
            <p className="muted">
              Activa el micrófono en el dock y mantén Espacio fuera de los campos de texto, o este
              botón en móvil. Al soltar, se silencia.
            </p>
          ) : null}
          <Participants room={voice.room} />
        </section>
      ) : null}
    </section>
  );
}
