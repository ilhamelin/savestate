import { newsText } from './gaming-news.ts';

export type HoyoGame = 'genshin' | 'hsr';
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
