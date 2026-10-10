import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { ProfileLolTracker } from '@/components/profile-lol-tracker';
import { lolAccount } from '@/domain/lol-accounts';
import { ProfileWallpaper } from '@/components/profile-wallpaper';

export const metadata = { title: 'Rift Tracker · League of Legends' };
export default async function RiftPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const hasLink = params.riotId !== undefined || params.platform !== undefined;
  const account = hasLink ? lolAccount({ riotId: params.riotId, platform: params.platform }) : null;
  const next = account
    ? `/rift?${new URLSearchParams({ riotId: account.riotId, platform: account.platform })}`
    : '/rift';
  if (!(await currentUser())) redirect(`/login?next=${encodeURIComponent(next)}`);
  return (
    <ProfileWallpaper url="/wallpapers/neon_cyberpunk.svg" fullScreen>
      <ProfileLolTracker
        key={next + String(hasLink)}
        configured={Boolean(process.env.RIOT_API_KEY?.trim())}
        initialAccount={account}
        initialError={
          hasLink && !account
            ? 'El enlace debe incluir un Riot ID Nombre#TAG y una plataforma válida.'
            : ''
        }
      />
    </ProfileWallpaper>
  );
}
