import type { ConsoleProgress } from '@/domain/console-progress';
export function ConsoleProgressBadge({
  progress,
  platform,
}: {
  progress: ConsoleProgress;
  platform?: string;
}) {
  const xbox = progress.kind === 'gamerscore',
    source = xbox ? 'Xbox Live' : 'PlayStation Network';
  return (
    <div className="console-progress-badge" role="group" aria-label={`Progreso de ${source}`}>
      <span className="console-progress-heading">
        {xbox ? '🎮 Gamerscore' : '🏆 Trofeos'} · {source}
      </span>
      <strong>
        {progress.current} / {progress.total} {xbox ? 'G' : 'trofeos'}
      </strong>
      <progress
        value={Math.min(progress.current, progress.total)}
        max={progress.total}
        aria-label={`Progreso de ${source}`}
      />
      {platform ? <span className="muted">{platform}</span> : null}
    </div>
  );
}
