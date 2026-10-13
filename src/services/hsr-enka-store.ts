import 'server-only';
import { unstable_cache } from 'next/cache';
import { record } from '@/domain/game-live-telemetry';
import type { HsrEnkaStore } from '@/domain/competitive-tracker';
async function storeJson(file: string) {
  const response = await fetch(
    `https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/hsr/${file}.json`,
    {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'SaveState/1.0 (+https://savestate.app)' },
      cache: 'no-store',
      redirect: 'error',
    },
  );
  if (!response.ok) throw new Error('HSR metadata unavailable');
  return record(await response.json());
}
const cachedHsrEnkaStore = unstable_cache(
  async (): Promise<HsrEnkaStore> => {
    const results = await Promise.allSettled([
      storeJson('avatars'),
      storeJson('weapons'),
      storeJson('hsr'),
    ]);
    const avatars = results[0].status === 'fulfilled' ? results[0].value : {};
    const weapons = results[1].status === 'fulfilled' ? results[1].value : {};
    const loc = results[2].status === 'fulfilled' ? results[2].value : {};
    return { avatars, weapons, locEs: record(loc.es), locEn: record(loc.en) };
  },
  ['hsr-enka-store-v1'],
  { revalidate: 86400 },
);
let memoryStore: { value: HsrEnkaStore; expires: number } | null = null;
let pendingStore: Promise<HsrEnkaStore> | null = null;
export async function getHsrEnkaStore(): Promise<HsrEnkaStore> {
  if (memoryStore && memoryStore.expires > Date.now()) return memoryStore.value;
  if (!pendingStore) {
    pendingStore = cachedHsrEnkaStore()
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
