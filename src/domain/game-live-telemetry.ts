export type GameDealItem = {
  dealId: string;
  storeName: string;
  salePrice: string;
  normalPrice: string;
  savingsPercent: number;
  dealUrl: string;
};
export type TwitchStreamItem = {
  id: string;
  userName: string;
  userLogin: string;
  title: string;
  viewerCount: number;
  language: string;
  thumbnailUrl: string;
  streamUrl: string;
};
export type GameLiveTelemetry = {
  usdToClpRate?: number | null;
  steamAppId: number | null;
  steamCurrentPlayers: number | null;
  historicalLow: { price: string; dateIso: string | null } | null;
  deals: GameDealItem[];
  twitchStreams: TwitchStreamItem[];
  twitchTotalTopViewers: number;
};
export function formatClpPrice(usdPrice: string | number, rate?: number | null): string {
  const amount = typeof usdPrice === 'string' ? parseFloat(usdPrice) : usdPrice;
  if (!Number.isFinite(amount) || amount <= 0 || !rate || !Number.isFinite(rate) || rate <= 0)
    return '';
  const clp = Math.round(amount * rate);
  return Number.isFinite(clp) ? `(~$${clp.toLocaleString('es-CL')} CLP)` : '';
}
const stores: Record<string, string> = {
  '1': 'Steam',
  '2': 'GamersGate',
  '3': 'GreenManGaming',
  '7': 'GOG',
  '8': 'EA App',
  '11': 'Humble Store',
  '13': 'Ubisoft Store',
  '15': 'Fanatical',
  '21': 'WinGameStore',
  '23': 'GameBillet',
  '25': 'Epic Games Store',
  '27': 'Gamesplanet',
  '30': 'IndieGala',
};
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function nonnegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
function price(value: unknown): string | null {
  return typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value) ? value : null;
}
export function mapDeals(value: unknown): GameDealItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).flatMap((raw) => {
    const deal = record(raw),
      sale = price(deal.salePrice),
      normal = price(deal.normalPrice);
    if (typeof deal.dealID !== 'string' || !deal.dealID || !sale || !normal) return [];
    let decodedId = deal.dealID;
    try {
      decodedId = decodeURIComponent(decodedId);
    } catch {
      /* Keep raw IDs when not URL-encoded. */
    }
    return [
      {
        dealId: deal.dealID,
        storeName: stores[String(deal.storeID)] ?? 'Tienda PC',
        salePrice: sale,
        normalPrice: normal,
        savingsPercent: Math.max(0, Math.min(100, Math.round(Number(deal.savings) || 0))),
        dealUrl: `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(decodedId)}`,
      },
    ];
  });
}
export function mapStreams(value: unknown): TwitchStreamItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).flatMap((raw) => {
    const stream = record(raw);
    if (
      typeof stream.id !== 'string' ||
      typeof stream.user_login !== 'string' ||
      !/^[a-zA-Z0-9_]{1,25}$/.test(stream.user_login)
    )
      return [];
    let thumbnailUrl = '';
    try {
      const url = new URL(
        String(stream.thumbnail_url).replace('{width}', '320').replace('{height}', '180'),
      );
      if (
        url.protocol === 'https:' &&
        url.hostname === 'static-cdn.jtvnw.net' &&
        !url.username &&
        !url.password
      )
        thumbnailUrl = url.href;
    } catch {
      /* Ignore untrusted thumbnail URLs. */
    }
    return [
      {
        id: stream.id,
        userLogin: stream.user_login,
        userName: String(stream.user_name ?? stream.user_login).slice(0, 100),
        title: String(stream.title ?? '').slice(0, 300),
        viewerCount: nonnegative(stream.viewer_count) ?? 0,
        language: String(stream.language ?? ''),
        thumbnailUrl,
        streamUrl: `https://www.twitch.tv/${stream.user_login}`,
      },
    ];
  });
}
export function mapHistoricalLow(value: unknown): GameLiveTelemetry['historicalLow'] {
  const low = record(record(value).cheapestPriceEver),
    amount = price(low.price);
  if (!amount) return null;
  const timestamp = nonnegative(low.date);
  const date = timestamp === null ? null : new Date(timestamp * 1000);
  return {
    price: amount,
    dateIso: date && Number.isFinite(date.getTime()) ? date.toISOString() : null,
  };
}
