export const HALLOWEEN_END_MS = Date.parse('2026-11-03T03:00:00Z');

export function effectiveSeasonalTheme(
  theme?: string | null,
  nowMs = Date.now(),
): 'halloween' | 'classic' {
  return (theme ?? 'halloween') === 'halloween' && nowMs <= HALLOWEEN_END_MS
    ? 'halloween'
    : 'classic';
}
