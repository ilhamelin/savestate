export const GTA6_RELEASE_DATE = '2026-11-19T00:00:00.000Z';
export const GTA6_RELEASE_TEXT =
  'Grand Theft Auto VI saldrá oficialmente el 19 de noviembre de 2026 para PlayStation 5 y Xbox Series X|S';
export const GTA6_ANNOUNCEMENT_INTERVAL = 5 * 86400000;
export function getGta6Countdown(nowMs = Date.now()) {
  const totalMs = Math.max(0, Date.parse(GTA6_RELEASE_DATE) - nowMs);
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
export function shouldAnnounceGta6Countdown(history: unknown[], nowMs = Date.now()) {
  const countdown = getGta6Countdown(nowMs);
  const bucket = Math.floor(countdown.days / 5);
  const nonce = `gta6:${bucket}`;
  const blocked = history.slice(0, 100).some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const message = entry as { timestamp?: unknown; embeds?: { footer?: { text?: unknown } }[] };
    if (!Array.isArray(message.embeds)) return false;
    return message.embeds.some((embed) => {
      const footer = embed?.footer?.text;
      if (typeof footer !== 'string') return false;
      const marker = footer.match(/^savestate-gta6-countdown:(\d+)(?:\s|$)/);
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
