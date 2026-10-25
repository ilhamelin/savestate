/** Dates are optional metadata; never let an invalid upstream value stop rendering. */
export function safeFormatIsoDate(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toLocaleDateString('es-CL', { timeZone: 'UTC' });
}
export function safeGameDomId(title: unknown): string {
  return (
    (typeof title === 'string' ? title : 'game')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'game'
  );
}
export function normalizeUnlockPercentage(value: unknown): number {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN;
  if (!Number.isFinite(number)) return 0;
  return Math.round(Math.min(100, Math.max(0, number)) * 10) / 10;
}
export function achievementPercentageForKey(map: unknown, key: unknown): number {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return 0;
  if (typeof key !== 'string' && (typeof key !== 'number' || !Number.isFinite(key))) return 0;
  const internalKey = String(key);
  // JSON object keys are strings even when Steam supplies a numeric internal_key.
  const raw = Object.hasOwn(map, internalKey)
    ? (map as Record<string, unknown>)[internalKey]
    : undefined;
  return normalizeUnlockPercentage(raw);
}
