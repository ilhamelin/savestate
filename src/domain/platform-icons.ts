export const PLATFORM_ICON_PATHS = {
  playstation: '/platforms/playstation.png',
  xbox: '/platforms/xbox.png',
  steam: '/platforms/steam.png',
} as const;

export function resolvePlatformIcon(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  if (/\b(?:playstation|psn|ps[1-5v]|ps\s+vita)\b/.test(normalized)) {
    return PLATFORM_ICON_PATHS.playstation;
  }
  if (normalized.includes('xbox')) return PLATFORM_ICON_PATHS.xbox;
  if (normalized.includes('steam')) return PLATFORM_ICON_PATHS.steam;
  return null;
}
