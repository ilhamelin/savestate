import type { ConsoleRow, ConsoleSource } from './console-import.ts';
import type { ConsoleProgress } from './console-progress.ts';
export interface ImportedProgressLog {
  id: string;
  title: string;
  platform: string;
  note: string;
  progress?: ConsoleProgress | null;
}
const normalize = (title: string) =>
  title.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export function consoleProgressUpdates(
  logs: ImportedProgressLog[],
  rows: ConsoleRow[],
  source: ConsoleSource,
) {
  const kind = source === 'Xbox' ? 'gamerscore' : 'trophies';
  const index = new Map<string, ConsoleRow[]>();
  for (const row of rows) {
    if (row.progress?.kind !== kind) continue;
    const key = normalize(row.title);
    index.set(key, [...(index.get(key) ?? []), row]);
  }
  return logs.flatMap((log) => {
    if (
      log.progress?.kind !== kind &&
      log.note !== `[${source}] Partida importada a la biblioteca.`
    )
      return [];
    const origin =
      typeof log.progress?.source_title === 'string' && log.progress.source_title.length <= 200
        ? log.progress.source_title
        : log.title;
    const candidates = index.get(normalize(origin)) ?? [];
    const exactPlatform = candidates.filter(
      (row) => normalize(row.platform) === normalize(log.platform),
    );
    const options = exactPlatform.length ? exactPlatform : candidates;
    if (options.length !== 1) return [];
    const row = options[0]!;
    return [{ id: log.id, progress: { ...row.progress!, source_title: row.title } }];
  });
}
