import { ValidationError } from './validation.ts';
import type { LolMatchSummary } from './lol-tracker.ts';

export function lolPage(start: unknown = 0, count: unknown = 10) {
  if (
    typeof start !== 'number' ||
    !Number.isSafeInteger(start) ||
    start < 0 ||
    start > 10000 ||
    typeof count !== 'number' ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 10
  )
    throw new ValidationError(
      'Paginación inválida: start debe ser un entero entre 0 y 10000 y count entre 1 y 10.',
    );
  return { start, count };
}
export function mergeLolMatches(previous: LolMatchSummary[], next: LolMatchSummary[]) {
  const unique = new Map(previous.map((match) => [match.matchId, match]));
  for (const match of next) if (!unique.has(match.matchId)) unique.set(match.matchId, match);
  return [...unique.values()].sort((a, b) => b.gameEndTimestamp - a.gameEndTimestamp);
}
