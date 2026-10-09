import type { ConsoleProgress } from '@/domain/console-progress';
export function ConsoleProgressBadge({
  progress,
  platform,
}: {
  progress: ConsoleProgress;
  platform?: string;
}) {
  const xbox = progress.kind === 'gamerscore',
    steam = progress.kind === 'achievements',
    source = steam ? 'Steam' : xbox ? 'Xbox Live' : 'PlayStation Network';
  return (
    <div className="console-progress-badge" role="group" aria-label={`Progreso de ${source}`}>
      <span className="console-progress-heading">
        {steam ? '🏆 Logros' : xbox ? '🎮 Gamerscore' : '🏆 Trofeos'} · {source}
      </span>
      <strong>
        {progress.current} / {progress.total} {steam ? 'logros' : xbox ? 'G' : 'trofeos'}
        {steam ? ` (${Math.round((progress.current / progress.total) * 100)}%)` : ''}
      </strong>
      <progress
        value={Math.min(progress.current, progress.total)}
        max={progress.total}
        aria-label={`Progreso de ${source}`}
      />
      {steam || platform ? <span className="muted">{steam ? 'PC / Steam' : platform}</span> : null}
    </div>
  );
}
