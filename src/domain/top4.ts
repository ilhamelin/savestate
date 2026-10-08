import { ValidationError, uuid } from './validation.ts';
export function favoriteSlot(input: unknown): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < 1 || input > 4)
    throw new ValidationError('Selecciona una ranura del 1 al 4.');
  return input;
}
export function favoriteGame(input: unknown): string | null {
  return input === null ? null : uuid(input);
}
