import 'server-only';
import { unstable_cache } from 'next/cache';
import { record } from '@/domain/game-live-telemetry';
import type { EnkaStore } from '@/domain/genshin-build';
async function storeJson(file: string) {
  const response = await fetch(
    `https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/${file}.json`,
    {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'SaveState/1.0 (+https://savestate.app)' },
      cache: 'no-store',
      redirect: 'error',
    },
  );
  if (!response.ok) throw new Error('Enka metadata unavailable');
  return record(await response.json());
}
export const getEnkaStore = unstable_cache(
  async (): Promise<EnkaStore> => {
    const results = await Promise.allSettled([storeJson('characters'), storeJson('loc')]);
    const characters = results[0].status === 'fulfilled' ? results[0].value : {};
    const loc = results[1].status === 'fulfilled' ? results[1].value : {};
    return { characters, locEs: record(loc.es), locEn: record(loc.en) };
  },
  ['enka-store-metadata-v1'],
  { revalidate: 86400 },
);
