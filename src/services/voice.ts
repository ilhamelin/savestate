import 'server-only';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { voiceChannel, voiceServerUrl } from '@/domain/voice';
import { AppError } from '@/lib/http';

export async function createVoiceToken(
  channelId: unknown,
  profile: { id: string; username: string; avatar_url: string | null },
) {
  const channel = voiceChannel(channelId);
  const url = voiceServerUrl(process.env.LIVEKIT_URL, process.env.NODE_ENV === 'development');
  const key = process.env.LIVEKIT_API_KEY?.trim();
  const secret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !key || !secret)
    throw new AppError(
      'Savestate Comms aún no está configurado. Configura las variables de LiveKit.',
      503,
    );
  const rooms = new RoomServiceClient(
    url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'),
    key,
    secret,
    { requestTimeout: 8 },
  );
  try {
    const room = await rooms.createRoom({
      name: channel.id,
      maxParticipants: channel.maxParticipants,
      emptyTimeout: 300,
      departureTimeout: 60,
    });
    if (room.maxParticipants !== channel.maxParticipants) throw new Error('Room capacity mismatch');
  } catch {
    throw new AppError(
      'No se pudo preparar la frecuencia. Comprueba la configuración de LiveKit o inténtalo de nuevo.',
      503,
    );
  }
  const at = new AccessToken(key, secret, {
    identity: profile.id,
    name: profile.username,
    ttl: '15m',
    metadata: JSON.stringify({ avatarUrl: profile.avatar_url }),
  });
  at.addGrant({
    roomJoin: true,
    room: channel.id,
    canPublish: true,
    canPublishSources: [TrackSource.MICROPHONE],
    canPublishData: true,
    canSubscribe: true,
    canUpdateOwnMetadata: false,
  });
  return { token: await at.toJwt(), url };
}
