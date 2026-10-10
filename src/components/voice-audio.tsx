'use client';
import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';
import type { Room } from 'livekit-client';
export function VoiceAudio({ room, muted }: { room: Room; muted: boolean }) {
  return (
    <RoomContext.Provider value={room}>
      <RoomAudioRenderer room={room} muted={muted} />
    </RoomContext.Provider>
  );
}
