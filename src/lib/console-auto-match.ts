type Match = { id: string; title: string };
export async function matchConsoleRows<T extends Match>(
  rows: { index: number; title: string }[],
  options: {
    signal: AbortSignal;
    search: (title: string, signal: AbortSignal) => Promise<T[]>;
    result: (index: number, games: T[], chosen: T | undefined, error?: string) => void;
    progress: (processed: number) => void;
  },
) {
  let processed = 0,
    matched = 0,
    failures = 0;
  for (const row of rows) {
    if (options.signal.aborted) break;
    try {
      const games = await options.search(row.title, options.signal);
      if (options.signal.aborted) break;
      const normalize = (title: string) => title.normalize('NFKC').trim().toLowerCase();
      const chosen =
        games.find((game) => normalize(game.title) === normalize(row.title)) ?? games[0];
      if (chosen) matched++;
      options.result(row.index, games, chosen);
    } catch (error) {
      if (options.signal.aborted) break;
      failures++;
      options.result(
        row.index,
        [],
        undefined,
        error instanceof Error ? error.message : 'No se pudo emparejar.',
      );
    }
    options.progress(++processed);
  }
  return { processed, matched, failures, stopped: options.signal.aborted };
}
