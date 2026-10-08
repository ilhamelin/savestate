export const CRT_PALETTES = {
  cyan: 'Cyber Cyan',
  green: 'Matrix Green',
  amber: 'Amber CRT',
  dmg: 'Game Boy DMG',
} as const;
export type CrtPalette = keyof typeof CRT_PALETTES;
export function crtPalette(value: unknown): CrtPalette {
  return typeof value === 'string' && Object.hasOwn(CRT_PALETTES, value)
    ? (value as CrtPalette)
    : 'cyan';
}
