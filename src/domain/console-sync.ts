import type { ConsoleRow } from './console-import.ts';
import { ValidationError } from './validation.ts';
import { consoleProgress, type ConsoleProgress } from './console-progress.ts';
const record = (input: unknown): Record<string, unknown> =>
  input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
const normalized = (input: unknown) =>
  typeof input === 'string' ? input.normalize('NFKC').trim().toLowerCase() : '';
export function parseIsoDuration(duration: unknown): number {
  if (typeof duration !== 'string' || duration.length > 100) return 0;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match || !match.slice(1).some(Boolean)) return 0;
  const total = Number(match[1] ?? 0) + Number(match[2] ?? 0) / 60 + Number(match[3] ?? 0) / 3600;
  const rounded = Math.round(total * 100) / 100;
  return Number.isFinite(rounded) ? rounded : 0;
}
export function psnPlaytimes(input: unknown): Map<string, number> {
  const result = new Map<string, number>();
  if (!Array.isArray(input)) return result;
  for (const item of input) {
    const row = record(item);
    if (typeof row.category === 'string' && row.category.includes('media_app')) continue;
    const title = normalized(row.name);
    const hours = parseIsoDuration(row.playDuration);
    if (title && hours <= 100000) result.set(title, Math.max(result.get(title) ?? 0, hours));
  }
  return result;
}
export function exactPsnAccount(input: unknown, identity: string): string | null {
  const domains = record(input).domainResponses;
  if (!Array.isArray(domains)) throw new ValidationError('Respuesta PSN inválida.');
  for (const domain of domains) {
    const results = record(domain).results;
    if (!Array.isArray(results)) continue;
    for (const result of results) {
      const metadata = record(record(result).socialMetadata);
      if (
        normalized(metadata.onlineId) === normalized(identity) &&
        typeof metadata.accountId === 'string' &&
        /^\d{1,20}$/.test(metadata.accountId)
      )
        return metadata.accountId;
    }
  }
  return null;
}
export function exactXboxAccount(input: unknown, identity: string): string | null {
  const value = record(input);
  const people = [value.people, record(value.content).profileUsers, value.profileUsers].find(
    Array.isArray,
  );
  if (!Array.isArray(people)) throw new ValidationError('Respuesta Xbox inválida.');
  for (const item of people) {
    const person = record(item);
    const settings = Array.isArray(person.settings) ? person.settings : [];
    const gamertag = record(settings.find((setting) => record(setting).id === 'Gamertag')).value;
    const xuid = person.id ?? person.xuid;
    const names = [
      gamertag,
      person.gamertag,
      person.uniqueModernGamertag,
      !person.modernGamertagSuffix ? person.modernGamertag : null,
    ];
    if (
      names.some((name) => normalized(name) === normalized(identity)) &&
      typeof xuid === 'string' &&
      /^\d{1,20}$/.test(xuid)
    )
      return xuid;
  }
  return null;
}
function mappedTitles(
  input: unknown,
  provider: 'psn' | 'xbox',
  playtimes?: Map<string, number>,
): ConsoleRow[] {
  if (!Array.isArray(input) || input.length > 5000)
    throw new ValidationError('Lista de títulos inválida.');
  const rows: ConsoleRow[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    const value = record(item),
      title = provider === 'psn' ? value.trophyTitleName : value.name;
    if (
      typeof title !== 'string' ||
      !title.trim() ||
      title.trim().length > 200 ||
      value.hiddenFlag === true
    )
      continue;
    let platform: string | undefined,
      complete = false;
    let progress: ConsoleProgress | null = null;
    if (provider === 'psn') {
      const raw =
        typeof value.trophyTitlePlatform === 'string'
          ? value.trophyTitlePlatform
              .toUpperCase()
              .split(',')
              .map((part) => part.trim())
          : [];
      const platforms: Record<string, string> = {
        PS5: 'PlayStation 5',
        PS4: 'PlayStation 4',
        PS3: 'PlayStation 3',
        PSVITA: 'PlayStation Vita',
        VITA: 'PlayStation Vita',
        PSP: 'PSP',
      };
      platform = raw.map((part) => platforms[part]).find(Boolean);
      const platinum = record(value.earnedTrophies).platinum;
      complete =
        value.progress === 100 ||
        (typeof platinum === 'number' && Number.isFinite(platinum) && platinum > 0);
      const earned = record(value.earnedTrophies),
        defined = record(value.definedTrophies);
      const kinds = ['bronze', 'silver', 'gold', 'platinum'];
      if (
        kinds.every(
          (kind) =>
            Number.isInteger(earned[kind]) &&
            (earned[kind] as number) >= 0 &&
            Number.isInteger(defined[kind]) &&
            (defined[kind] as number) >= 0,
        )
      ) {
        try {
          progress = consoleProgress(
            {
              kind: 'trophies',
              current: kinds.reduce((sum, kind) => sum + (earned[kind] as number), 0),
              total: kinds.reduce((sum, kind) => sum + (defined[kind] as number), 0),
            },
            'PlayStation',
          );
        } catch {
          /* Missing or malformed upstream totals are not inferred. */
        }
      }
    } else {
      const devices = Array.isArray(value.devices) ? value.devices : [];
      const platforms: Record<string, string> = {
        XboxSeries: 'Xbox Series X|S',
        XboxScarlett: 'Xbox Series X|S',
        XboxOne: 'Xbox One',
        Xbox360: 'Xbox 360',
        Xbox: 'Xbox',
      };
      platform = devices
        .map((part) => (typeof part === 'string' ? platforms[part] : undefined))
        .find(Boolean);
      if (!platform && devices.length > 0 && devices.every((device) => device === 'PC'))
        platform = 'Xbox One';
      const achievement = record(value.achievement);
      const current = achievement.currentGamerscore ?? value.currentGamerscore;
      const total = achievement.totalGamerscore ?? value.maxGamerscore;
      try {
        progress = consoleProgress({ kind: 'gamerscore', current, total }, 'Xbox');
      } catch {
        /* Do not turn incomplete achievement data into invented scores. */
      }
      complete =
        typeof current === 'number' &&
        typeof total === 'number' &&
        Number.isFinite(current) &&
        Number.isFinite(total) &&
        total > 0 &&
        current >= total;
    }
    if (!platform) continue;
    const key = `${normalized(title)}:${platform}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const playedHours = provider === 'psn' ? playtimes?.get(normalized(title)) : undefined;
    rows.push({
      title: title.trim(),
      platform,
      hours:
        typeof playedHours === 'number' &&
        Number.isFinite(playedHours) &&
        playedHours >= 0 &&
        playedHours <= 100000
          ? playedHours
          : 0,
      status: complete ? 'cleared' : 'playing',
      ...(progress ? { progress } : {}),
    });
    if (rows.length === 200) break;
  }
  return rows;
}
export const psnTitleRows = (input: unknown, playtimes?: Map<string, number>) =>
  mappedTitles(input, 'psn', playtimes);
export const xboxTitleRows = (input: unknown) => mappedTitles(input, 'xbox');
