import { newsText } from './gaming-news.ts';

export type HoyoGame = 'genshin' | 'hsr';
export type HoyoNewsCategory = 'todas' | HoyoNewsItem['category'];
export interface HoyoCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isPast: boolean;
  formatted: string;
}
export interface HoyoVersionSchedule {
  currentVersion: string;
  nextVersion: string;
  currentTitle: string;
  nextReleaseDate: string;
  phase: 1 | 2;
  phaseEndDate: string;
  specialProgramDate: string;
  cycleTotalDays: number;
  daysIntoCycle: number;
  progressPercent: number;
}
// Editorial reference dates supplied for the hub, not an automatic confirmation by HoYoverse.
export const HOYO_VERSION_SCHEDULES: Record<HoyoGame, HoyoVersionSchedule> = {
  genshin: {
    currentVersion: '7.1',
    nextVersion: '7.2',
    currentTitle: 'Un réquiem para el inframundo',
    nextReleaseDate: '2026-11-04T03:00:00Z',
    phase: 2,
    phaseEndDate: '2026-11-04T02:59:59Z',
    specialProgramDate: '2026-10-23T12:00:00Z',
    cycleTotalDays: 42,
    daysIntoCycle: 23,
    progressPercent: 55,
  },
  hsr: {
    currentVersion: '4.6',
    nextVersion: '4.7',
    currentTitle: 'Danza con la bestia antes de que se alce la luna',
    nextReleaseDate: '2026-11-10T03:00:00Z',
    phase: 2,
    phaseEndDate: '2026-11-10T02:59:59Z',
    specialProgramDate: '2026-10-30T11:30:00Z',
    cycleTotalDays: 42,
    daysIntoCycle: 19,
    progressPercent: 45,
  },
};
export interface HoyoQuickTool {
  id: string;
  label: string;
  description: string;
  url: string;
  iconName: 'calendar' | 'map' | 'shield' | 'trophy';
}
export const HOYO_QUICK_TOOLS: Record<HoyoGame, HoyoQuickTool[]> = {
  genshin: [
    {
      id: 'checkin',
      label: 'Check-in Diario',
      description: 'Reclama las recompensas del calendario',
      url: 'https://act.hoyolab.com/ys/event/signin-sea-v3/index.html?act_id=e202102251931481',
      iconName: 'calendar',
    },
    {
      id: 'map',
      label: 'Mapa de Teyvat',
      description: 'Cofres, óculos y rutas de farmeo',
      url: 'https://act.hoyolab.com/ys/app/interactive-map/index.html',
      iconName: 'map',
    },
    {
      id: 'showcase',
      label: 'Mi Vitrina Genshin',
      description: 'Tus personajes en el tracker de SaveState',
      url: '/rift?game=genshin',
      iconName: 'trophy',
    },
  ],
  hsr: [
    {
      id: 'checkin',
      label: 'Check-in Diario',
      description: 'Reclama las recompensas del calendario',
      url: 'https://act.hoyolab.com/bbs/event/signin/hkrpg/index.html?act_id=e202303301540311',
      iconName: 'calendar',
    },
    {
      id: 'map',
      label: 'Mapa del Expreso',
      description: 'Tesoros y rutas de los mundos',
      url: 'https://act.hoyolab.com/sr/app/interactive-map/index.html',
      iconName: 'map',
    },
    {
      id: 'showcase',
      label: 'Mi Vitrina HSR',
      description: 'Tus personajes en el tracker de SaveState',
      url: '/rift?game=hsr',
      iconName: 'trophy',
    },
  ],
};
export function calculateHoyoCountdown(targetDateIso: string, nowMs = Date.now()): HoyoCountdown {
  const targetMs = Date.parse(targetDateIso);
  if (!Number.isFinite(targetMs) || !Number.isFinite(nowMs))
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isPast: true,
      formatted: '00d 00h 00m 00s',
    };
  const totalSeconds = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const days = Math.floor(totalSeconds / 86400),
    hours = Math.floor((totalSeconds % 86400) / 3600),
    minutes = Math.floor((totalSeconds % 3600) / 60),
    seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    isPast: targetMs <= nowMs,
    formatted: `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`,
  };
}
export function hoyoCycleProgress(schedule: HoyoVersionSchedule, nowMs = Date.now()) {
  const end = Date.parse(schedule.nextReleaseDate),
    span = schedule.cycleTotalDays * 86400000;
  if (!Number.isFinite(end) || !Number.isFinite(nowMs) || !Number.isFinite(span) || span <= 0)
    return { daysIntoCycle: 0, progressPercent: 0 };
  const elapsed = Math.max(0, Math.min(span, nowMs - (end - span)));
  return {
    daysIntoCycle: Math.floor(elapsed / 86400000),
    progressPercent: Math.round((elapsed / span) * 1000) / 10,
  };
}
export function filterHoyoNews(news: HoyoNewsItem[], category: HoyoNewsCategory): HoyoNewsItem[] {
  return category === 'todas' ? news : news.filter((item) => item.category === category);
}
export const HOYO_CLAIMED_CODES_KEY = 'hoyo_claimed_codes';
export function hoyoClaimedCodeKey(game: HoyoGame, code: string) {
  return `${game}:${code}`;
}
export function parseHoyoClaimedCodes(raw: string | null): Set<string> {
  try {
    const values: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(values)) return new Set();
    const result = new Set<string>();
    for (const value of values.slice(0, 1000)) {
      if (typeof value !== 'string') continue;
      if (/^(genshin|hsr):[A-Za-z0-9_-]{1,100}$/.test(value)) result.add(value);
      else
        for (const game of ['genshin', 'hsr'] as const) {
          if (HOYO_GAMES[game].featuredCodes.some((code) => code.code === value))
            result.add(hoyoClaimedCodeKey(game, value));
        }
    }
    return result;
  } catch {
    return new Set();
  }
}
export interface HoyoCode {
  code: string;
  rewards: string;
  expiresAt?: string;
  isExpired?: boolean;
}
export interface HoyoNewsItem {
  id: string;
  title: string;
  summary: string;
  coverUrl: string | null;
  postUrl: string;
  publishedAt: string;
  category: 'actualizacion' | 'evento' | 'aviso';
}
export interface HoyoGameConfig {
  id: HoyoGame;
  title: string;
  subtitle: string;
  accentColor: string;
  wallpaper: string;
  icon: string;
  twitchChannel: string;
  youtubeChannel: string;
  youtubeChannelId: string;
  redeemBaseUrl: string;
  enkaUrlSlug: string;
  version: { current: string | null; next: string | null; livestreamDate?: string };
  featuredCodes: HoyoCode[];
}
export const HOYO_GAMES: Record<HoyoGame, HoyoGameConfig> = {
  genshin: {
    id: 'genshin',
    title: 'Genshin Impact',
    subtitle: 'Teyvat Broadcast & Relic Hub',
    accentColor: '#f4c462',
    wallpaper: '/wallpapers/rift_genshin.jpg',
    icon: '/icons/games/genshin.png',
    twitchChannel: 'genshinimpactofficial',
    youtubeChannel: '@GenshinImpact',
    youtubeChannelId: 'UCiS882YPwZt1NfaM0gR0D9Q',
    redeemBaseUrl: 'https://genshin.hoyoverse.com/es/gift?code=',
    enkaUrlSlug: 'genshin',
    version: { current: null, next: null },
    featuredCodes: [{ code: 'GENSHINGIFT', rewards: '50 Protogemas + 3 Ingenio del Héroe' }],
  },
  hsr: {
    id: 'hsr',
    title: 'Honkai: Star Rail',
    subtitle: 'Astral Express Terminal & Cosmic Comms',
    accentColor: '#c084fc',
    wallpaper: '/wallpapers/rift_hsr.jpg',
    icon: '/icons/games/hsr.png',
    twitchChannel: 'honkaistarrail',
    youtubeChannel: '@HonkaiStarRail',
    youtubeChannelId: 'UC2PeMPA8PAOp-bynLoCeMLA',
    redeemBaseUrl: 'https://hsr.hoyoverse.com/gift?code=',
    enkaUrlSlug: 'hsr',
    version: { current: null, next: null },
    featuredCodes: [
      { code: 'STARRAILGIFT', rewards: '50 Jades estelares + materiales y créditos' },
    ],
  },
};
export function hoyoGame(value: unknown): HoyoGame {
  return value === 'hsr' ? 'hsr' : 'genshin';
}
export function buildHoyoRedeemUrl(game: HoyoGame, code: string): string {
  return `${HOYO_GAMES[game].redeemBaseUrl}${encodeURIComponent(code.trim())}`;
}
export function buildHoyoFrameUrl(
  game: HoyoGame,
  platform: 'twitch' | 'youtube',
  hostname: string,
): string | null {
  const config = HOYO_GAMES[game];
  if (platform === 'youtube')
    return `https://www.youtube.com/embed/live_stream?${new URLSearchParams({ channel: config.youtubeChannelId, autoplay: '0', rel: '0' })}`;
  if (!hostname || !/^[a-z\d.-]+$/i.test(hostname)) return null;
  return `https://player.twitch.tv/?${new URLSearchParams({ channel: config.twitchChannel, parent: hostname, autoplay: 'false' })}`;
}
export function hoyoCodeExpired(code: HoyoCode, nowMs = Date.now()): boolean {
  return (
    code.isExpired === true ||
    Boolean(
      code.expiresAt &&
      Number.isFinite(Date.parse(code.expiresAt)) &&
      Date.parse(code.expiresAt) <= nowMs,
    )
  );
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function plain(value: unknown, limit: number): string {
  return typeof value === 'string' ? newsText(value.slice(0, 20000)).slice(0, limit) : '';
}
export function safeHoyoImage(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      [
        'upload-os-bbs.hoyolab.com',
        'hyl-static-res-prod.hoyolab.com',
        'fastcdn.hoyoverse.com',
        'act-upload.hoyoverse.com',
      ].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function parseHoyoNews(json: unknown): HoyoNewsItem[] {
  const root = record(json),
    data = record(root.data);
  if (root.retcode !== undefined && root.retcode !== 0) return [];
  const list = Array.isArray(data.list) ? data.list : [];
  const items = new Map<string, HoyoNewsItem>();
  for (const raw of list.slice(0, 40)) {
    const item = record(raw),
      post = record(item.post);
    const id =
      typeof post.post_id === 'string' ||
      (typeof post.post_id === 'number' && Number.isSafeInteger(post.post_id))
        ? String(post.post_id)
        : '';
    const title = plain(post.subject, 240);
    if (
      !/^[1-9]\d{0,23}$/.test(id) ||
      !title ||
      (post.lang && post.lang !== 'es-es') ||
      items.has(id)
    )
      continue;
    const images = Array.isArray(item.image_list) ? item.image_list : [];
    const postImages = Array.isArray(post.images) ? post.images : [];
    const coverUrl =
      [
        post.cover,
        record(item.cover).url,
        ...images.slice(0, 5).map((img) => record(img).url),
        ...postImages.slice(0, 5),
      ]
        .map(safeHoyoImage)
        .find(Boolean) ?? null;
    const seconds = typeof post.created_at === 'number' ? post.created_at : Number(post.created_at);
    const date = new Date(seconds * 1000);
    const publishedAt =
      Number.isFinite(seconds) && seconds > 0 && Number.isFinite(date.getTime())
        ? date.toISOString()
        : '';
    const lower = title.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const category = /version|actualizacion|mantenimiento/.test(lower)
      ? 'actualizacion'
      : /evento|desafio|gachapon|salto/.test(lower)
        ? 'evento'
        : 'aviso';
    items.set(id, {
      id,
      title,
      summary: plain(post.desc || post.content, 180),
      coverUrl,
      postUrl: `https://www.hoyolab.com/article/${id}`,
      publishedAt,
      category,
    });
  }
  return [...items.values()]
    .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
    .slice(0, 10);
}
export function hoyoVersionInNews(news: HoyoNewsItem[]): string | null {
  for (const item of news) {
    const version = /(?:versi[oó]n\s*|\bV)(\d{1,2}\.\d{1,2})\b/i.exec(item.title)?.[1];
    if (version) return version;
  }
  return null;
}
