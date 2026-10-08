import { ValidationError, text } from './validation.ts';

export const POPULAR_HARDWARE = [
  'PC / Steam',
  'PlayStation 5',
  'PlayStation 4',
  'PlayStation 2',
  'PlayStation 1',
  'Nintendo Switch',
  'Nintendo 64',
  'Super Nintendo (SNES)',
  'Game Boy',
  'Game Boy Advance',
  'Xbox Series',
  'Xbox 360',
  'Sega Genesis / Mega Drive',
  'Steam Deck / Portátil PC',
] as const;
export const MAX_HARDWARE = 16;
export const MAX_HARDWARE_NAME = 48;
function control(character: string) {
  const code = character.charCodeAt(0);
  return code < 32 || code === 127;
}
export function hardwareForDisplay(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const names = input
    .slice(0, MAX_HARDWARE)
    .filter((value): value is string => typeof value === 'string')
    .map((value) =>
      Array.from(value)
        .filter((character) => !control(character))
        .join('')
        .trim()
        .slice(0, MAX_HARDWARE_NAME),
    )
    .filter(Boolean);
  return ownedPlatforms(names);
}
export function ownedPlatforms(input: unknown): string[] {
  if (!Array.isArray(input) || input.length > MAX_HARDWARE)
    throw new ValidationError(`Selecciona hasta ${MAX_HARDWARE} plataformas.`);
  const names = input.map((value) => {
    const name = text(value, 'Plataforma', MAX_HARDWARE_NAME);
    if (Array.from(name).some(control)) throw new ValidationError('Plataforma inválida.');
    return name;
  });
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.toLocaleLowerCase('es');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
