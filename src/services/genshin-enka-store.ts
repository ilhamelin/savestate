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
const cachedEnkaStore = unstable_cache(
  async (): Promise<EnkaStore> => {
    const results = await Promise.allSettled([
      storeJson('characters'),
      storeJson('loc'),
      storeJson('pfps'),
      storeJson('namecards'),
    ]);
    const characters = results[0].status === 'fulfilled' ? results[0].value : {};
    const loc = results[1].status === 'fulfilled' ? results[1].value : {};
    return {
      characters,
      locEs: record(loc.es),
      locEn: record(loc.en),
      pfps: results[2].status === 'fulfilled' ? results[2].value : {},
      namecards: results[3].status === 'fulfilled' ? results[3].value : {},
    };
  },
  ['enka-store-metadata-v2'],
  { revalidate: 86400 },
);
let memoryStore: { value: EnkaStore; expires: number } | null = null;
let pendingStore: Promise<EnkaStore> | null = null;
export async function getEnkaStore(): Promise<EnkaStore> {
  if (memoryStore && memoryStore.expires > Date.now()) return memoryStore.value;
  if (!pendingStore) {
    pendingStore = cachedEnkaStore()
      .then((value) => {
        memoryStore = { value, expires: Date.now() + 30 * 60 * 1000 };
        return value;
      })
      .finally(() => {
        pendingStore = null;
      });
  }
  return pendingStore;
}
export {
  resolveGenshinProfileIconUrl,
  resolveGenshinNameCardUrl,
  resolveGenshinRegionLabel,
  resolveCharacterSplashUrl,
  resolveConstellationList,
  resolveTalentList,
} from '@/domain/genshin-build';
