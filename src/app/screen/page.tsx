import { ScreenHub } from '@/components/screen/screen-hub';
import { currentUser } from '@/lib/session';
import {
  getScreenAdaptations,
  getScreenTrending,
  getScreenMediaDetail,
  screenEntries,
} from '@/services/screen';
import { screenId, screenRegion, screenType } from '@/domain/screen';
import { GAME_ADAPTATIONS_MATRIX } from '@/domain/game-adaptations';
import '../screen.css';
export const metadata = { title: 'Screen · Tu bitácora de cine y series' };
export default async function ScreenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let region = screenRegion(
    ['CL', 'MX', 'ES', 'US'].includes(process.env.NEXT_PUBLIC_JUSTWATCH_DEFAULT_REGION ?? '')
      ? process.env.NEXT_PUBLIC_JUSTWATCH_DEFAULT_REGION
      : 'CL',
  );
  if (typeof params.region === 'string')
    try {
      region = screenRegion(params.region);
    } catch {
      /* Default region. */
    }
  const [adaptations, items, journal, user] = await Promise.all([
    getScreenAdaptations(region),
    getScreenTrending('popular', region).catch(() => []),
    screenEntries(),
    currentUser(),
  ]);
  const featured = GAME_ADAPTATIONS_MATRIX.filter((link) => link.featuredOrder)
    .sort((a, b) => a.featuredOrder! - b.featuredOrder!)
    .flatMap((link) =>
      adaptations.filter(
        (item) => item.tmdbId === link.tmdbId && item.mediaType === link.mediaType,
      ),
    );
  let selected = featured[0] ?? null;
  if (typeof params.select === 'string')
    try {
      const id = screenId(params.select);
      const type =
        typeof params.type === 'string'
          ? screenType(params.type)
          : (GAME_ADAPTATIONS_MATRIX.find((item) => item.tmdbId === id)?.mediaType ?? 'tv');
      selected = await getScreenMediaDetail(id, type, region);
    } catch {
      /* Invalid or unavailable deep links keep the radar selection. */
    }
  return (
    <ScreenHub
      featured={featured}
      adaptations={adaptations}
      initialItems={items}
      entries={journal.entries}
      initialDetail={selected}
      initialRegion={region}
      initialOpenMobile={typeof params.select === 'string'}
      canEdit={Boolean(user)}
      available={journal.available}
    />
  );
}
