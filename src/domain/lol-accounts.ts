import { riotId, lolPlatform, type LolPlatform } from './lol-tracker.ts';

export interface LolAccount {
  riotId: string;
  platform: LolPlatform;
}
export function lolAccount(input: unknown): LolAccount | null {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const row = input as Record<string, unknown>;
    const name = riotId(row.riotId);
    return { riotId: `${name.gameName}#${name.tagLine}`, platform: lolPlatform(row.platform) };
  } catch {
    return null;
  }
}
export function sameLolAccount(a: LolAccount | null, b: LolAccount | null) {
  return Boolean(
    a &&
    b &&
    a.platform === b.platform &&
    a.riotId.toLocaleLowerCase() === b.riotId.toLocaleLowerCase(),
  );
}
export function recentLolAccounts(input: unknown): LolAccount[] {
  if (!Array.isArray(input)) return [];
  const result: LolAccount[] = [];
  for (const value of input.slice(0, 100)) {
    const account = lolAccount(value);
    if (account && !result.some((other) => sameLolAccount(other, account))) result.push(account);
    if (result.length === 5) break;
  }
  return result;
}
