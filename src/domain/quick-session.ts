import { ValidationError } from './validation.ts';
export function sessionMinutes(input: unknown): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < 1 || input > 1440)
    throw new ValidationError('Registra entre 1 y 1440 minutos enteros.');
  return input;
}
export function accumulatedHours(current: number, minutes: number): number {
  sessionMinutes(minutes);
  const next = Math.round((current + minutes / 60) * 100) / 100;
  if (!Number.isFinite(current) || current < 0 || next > 100000)
    throw new ValidationError('La partida no puede superar 100000 horas.');
  return next;
}
