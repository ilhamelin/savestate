import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { VoiceConsole } from '@/components/voice-console';
import { voiceServerUrl } from '@/domain/voice';
export const metadata = { title: 'Savestate Comms · Frecuencias de voz' };
export default async function VoicePage() {
  if (!(await currentUser())) redirect('/login?next=/community/voice');
  const configured = Boolean(
    voiceServerUrl(process.env.LIVEKIT_URL, process.env.NODE_ENV === 'development') &&
    process.env.LIVEKIT_API_KEY?.trim() &&
    process.env.LIVEKIT_API_SECRET?.trim(),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMMUNITY FREQUENCIES</p>
          <h1>Savestate Comms.</h1>
        </div>
      </div>
      <VoiceConsole configured={configured} />
    </>
  );
}
