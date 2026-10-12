export const GTA6_RELEASE_DATE = '2026-11-19T00:00:00.000Z';
export const GTA6_RELEASE_TEXT =
  'Grand Theft Auto VI saldrá oficialmente el 19 de noviembre de 2026 para PlayStation 5 y Xbox Series X|S';
export const GTA6_ANNOUNCEMENT_INTERVAL = 5 * 86400000;
export const ZELDA_OOT_RELEASE_DATE = '2026-11-05T05:00:00.000Z';
export const ZELDA_OOT_RELEASE_TEXT =
  'The Legend of Zelda: Ocarina of Time saldrá oficialmente el 5 de noviembre de 2026 para Nintendo Switch 2';
export function getCountdownTo(releaseIsoDate: string, nowMs = Date.now()) {
  const releaseMs = Date.parse(releaseIsoDate);
  if (!Number.isFinite(releaseMs) || !Number.isFinite(nowMs))
    throw new RangeError('Fecha de cuenta regresiva inválida.');
  const totalMs = Math.max(0, releaseMs - nowMs);
  const seconds = Math.floor(totalMs / 1000);
  return {
    released: totalMs === 0,
    totalMs,
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  };
}
export function getGta6Countdown(nowMs = Date.now()) {
  return getCountdownTo(GTA6_RELEASE_DATE, nowMs);
}
export function getZeldaOotCountdown(nowMs = Date.now()) {
  return getCountdownTo(ZELDA_OOT_RELEASE_DATE, nowMs);
}
export function shouldAnnounceGta6Countdown(history: unknown[], nowMs = Date.now()) {
  return shouldAnnounceCountdown(history, getGta6Countdown(nowMs), 'gta6', nowMs);
}
export function shouldAnnounceZeldaOotCountdown(history: unknown[], nowMs = Date.now()) {
  return shouldAnnounceCountdown(history, getZeldaOotCountdown(nowMs), 'zelda-oot', nowMs);
}
function shouldAnnounceCountdown(
  history: unknown[],
  countdown: ReturnType<typeof getCountdownTo>,
  id: 'gta6' | 'zelda-oot',
  nowMs: number,
) {
  const bucket = Math.floor(countdown.days / 5);
  const nonce = `${id}:${bucket}`;
  const blocked = history.slice(0, 100).some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const message = entry as { timestamp?: unknown; embeds?: { footer?: { text?: unknown } }[] };
    if (!Array.isArray(message.embeds)) return false;
    return message.embeds.some((embed) => {
      const footer = embed?.footer?.text;
      if (typeof footer !== 'string') return false;
      const marker = footer.match(new RegExp(`^savestate-${id}-countdown:(\\d+)(?:\\s|$)`));
      if (!marker) return false;
      const sentAt = typeof message.timestamp === 'string' ? Date.parse(message.timestamp) : NaN;
      return (
        Number(marker[1]) === bucket ||
        !Number.isFinite(sentAt) ||
        nowMs - sentAt < GTA6_ANNOUNCEMENT_INTERVAL
      );
    });
  });
  return { shouldAnnounce: !countdown.released && !blocked, bucket, nonce };
}
export type ReleaseCountdownId = 'gta6' | 'zelda-oot';
export interface ReleaseCountdownConfig {
  id: ReleaseCountdownId;
  tabNumber: number;
  tabLabel: string;
  radarLabel: string;
  title: string;
  releaseDate: string;
  releaseText: string;
  referenceNote: string;
  timerAriaLabel: string;
  releasedText: string;
  heroImage: string;
  iconImage: string;
  logoImage: string;
  themeClass: string;
  platforms: { label: string; icon: string }[];
}
export const RELEASE_COUNTDOWNS: readonly ReleaseCountdownConfig[] = [
  {
    id: 'gta6',
    tabNumber: 1,
    tabLabel: 'Grand Theft Auto VI',
    title: 'Grand Theft Auto VI',
    radarLabel: 'VICE CITY RADAR // LANZAMIENTO OFICIAL',
    releaseDate: GTA6_RELEASE_DATE,
    releaseText: GTA6_RELEASE_TEXT,
    referenceNote: 'Cuenta regresiva al 19/11/2026 · 00:00 UTC.',
    timerAriaLabel: 'Tiempo restante hasta el 19 de noviembre de 2026, 00:00 UTC',
    releasedText: '🌴 La fecha de lanzamiento ha llegado.',
    heroImage: '/gta6/hero.png',
    iconImage: '/gta6/icon-128.png',
    logoImage: '/gta6/logo.png',
    themeClass: 'countdown-theme-gta6',
    platforms: [
      { label: 'PlayStation 5', icon: '/platforms/playstation.png' },
      { label: 'Xbox Series X|S', icon: '/platforms/xbox.png' },
    ],
  },
  {
    id: 'zelda-oot',
    tabNumber: 2,
    tabLabel: 'Zelda: Ocarina of Time',
    title: 'The Legend of Zelda: Ocarina of Time',
    radarLabel: 'HYRULE CHRONICLES // LANZAMIENTO OFICIAL',
    releaseDate: ZELDA_OOT_RELEASE_DATE,
    releaseText: ZELDA_OOT_RELEASE_TEXT,
    referenceNote: 'Cuenta regresiva al 05/11/2026 · 12:00 AM EST (05:00 UTC).',
    timerAriaLabel: 'Tiempo restante hasta el 5 de noviembre de 2026, 12:00 AM EST',
    releasedText: '🗡️ La fecha de lanzamiento ha llegado.',
    heroImage: '/zelda/hero.jpg',
    iconImage: '/zelda/icon-128.png',
    logoImage: '/zelda/logo.png',
    themeClass: 'countdown-theme-zelda',
    platforms: [{ label: 'Nintendo Switch 2', icon: '/platforms/nintendo.png' }],
  },
];
