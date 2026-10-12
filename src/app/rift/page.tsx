import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { ProfileLolTracker } from '@/components/profile-lol-tracker';
import { lolAccount } from '@/domain/lol-accounts';
import { CompetitiveHubTabs } from '@/components/competitive-hub-tabs';
import { serverClient } from '@/integrations/supabase/server';
import { splitSocialAndTrackerLinks } from '@/domain/validation';
import { trackerLink } from '@/domain/tracker-accounts';

export const metadata = { title: 'Rift · Hub de trackers' };
export default async function RiftPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const link = trackerLink(params);
  const hasLink =
    link.tab === 'lol' && (params.riotId !== undefined || params.platform !== undefined);
  const account = hasLink ? lolAccount({ riotId: params.riotId, platform: params.platform }) : null;
  const next = account
    ? `/rift?${new URLSearchParams({ riotId: account.riotId, platform: account.platform })}`
    : link.next;
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const db = await serverClient();
  const { data: viewerProfile } = await db
    .from('profiles')
    .select('social_links,steam_id')
    .eq('id', user.id)
    .maybeSingle();
  const { genshinUid, hsrUid } = splitSocialAndTrackerLinks(viewerProfile?.social_links ?? {});
  return (
    <CompetitiveHubTabs
      key={next}
      savedGenshinUid={genshinUid}
      savedHsrUid={hsrUid}
      savedSteamId={viewerProfile?.steam_id ?? null}
      initialTab={link.tab}
      initialIdentity={link.identity}
      initialError={link.error}
    >
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
    </CompetitiveHubTabs>
  );
}
