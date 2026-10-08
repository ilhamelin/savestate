export const WALLPAPERS = [
  { id: 'neon_cyberpunk', name: 'Cyberpunk', url: '/wallpapers/neon_cyberpunk.svg' },
  { id: 'arcade_90s', name: 'Habitación 90s', url: '/wallpapers/arcade_90s.svg' },
  { id: 'synthwave_grid', name: 'Synthwave', url: '/wallpapers/synthwave_grid.svg' },
  { id: 'deep_space', name: 'Espacio', url: '/wallpapers/deep_space.svg' },
] as const;
export function isWallpaperPreset(value: unknown): value is string {
  return typeof value === 'string' && WALLPAPERS.some((preset) => preset.url === value);
}
export function wallpaperForDisplay(
  value: unknown,
  userId: string,
  storageUrl: string,
): string | null {
  if (isWallpaperPreset(value)) return value;
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    const url = new URL(value);
    return url.origin === new URL(storageUrl).origin &&
      url.pathname === `/storage/v1/object/public/profiles/${userId}/wallpaper.webp`
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
