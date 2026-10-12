export function discordRetryDelay(value: unknown): number | null {
  const seconds =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN;
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 30
    ? Math.ceil(seconds * 1000) + 100
    : null;
}
