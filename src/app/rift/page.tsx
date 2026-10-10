import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { ProfileLolTracker } from '@/components/profile-lol-tracker';

export const metadata = { title: 'Rift Tracker · League of Legends' };
export default async function RiftPage() {
  if (!(await currentUser())) redirect('/login?next=/rift');
  return <ProfileLolTracker configured={Boolean(process.env.RIOT_API_KEY?.trim())} />;
}
