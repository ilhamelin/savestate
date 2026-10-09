import { ValidationError } from './validation.ts';
import type { ConsoleSource } from './console-import.ts';
export interface ConsoleProgress {
  kind: 'gamerscore' | 'trophies';
  current: number;
  total: number;
}
export function consoleProgress(value: unknown, source: ConsoleSource): ConsoleProgress | null {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ValidationError('Progreso de consola inválido.');
  const input = value as Record<string, unknown>;
  const kind = source === 'Xbox' ? 'gamerscore' : 'trophies';
  if (
    input.kind !== kind ||
    !Number.isInteger(input.current) ||
    !Number.isInteger(input.total) ||
    (input.current as number) < 0 ||
    (input.total as number) <= 0 ||
    (input.current as number) > 10000000 ||
    (input.total as number) > 10000000
  )
    throw new ValidationError('Progreso de consola inválido.');
  return { kind, current: input.current as number, total: input.total as number };
}
export function consoleProgressLabel(progress: ConsoleProgress): string {
  return progress.kind === 'gamerscore'
    ? `[Xbox Live] ${progress.current} / ${progress.total} G`
    : `[PlayStation Network] ${progress.current} / ${progress.total} trofeos`;
}
