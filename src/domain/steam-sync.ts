export const STEAM_DAILY_LIMIT = 3;
export function steamSyncQuota(count: number, lastSync: string | null, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const previous = lastSync ? new Date(lastSync) : null;
  const sameDay =
    previous && Number.isFinite(previous.getTime()) && previous.toISOString().slice(0, 10) >= day;
  const used = sameDay ? Math.max(0, Math.min(STEAM_DAILY_LIMIT, Math.floor(count))) : 0;
  const reset = new Date(now);
  reset.setUTCHours(24, 0, 0, 0);
  return { remainingSlots: STEAM_DAILY_LIMIT - used, resetAt: reset.toISOString() };
}
export interface SteamSyncState {
  linked: boolean;
  remainingSlots: number;
  resetAt: string;
  configured: boolean;
  available: boolean;
  message: string | null;
}
