'use client';
import { ScreenCard } from './screen-card';
import type { ScreenMediaItem, ScreenUserProgress } from '@/domain/screen';
export function ScreenMediaGrid({
  items,
  progress,
  selected,
  onSelect,
  onAdvance,
  busy,
}: {
  items: ScreenMediaItem[];
  progress: Record<string, ScreenUserProgress>;
  selected: string | null;
  onSelect: (item: ScreenMediaItem) => void;
  onAdvance: (item: ScreenMediaItem) => void;
  busy: boolean;
}) {
  return (
    <div className="screen-media-grid">
      {items.map((item) => (
        <ScreenCard
          key={item.id}
          item={item}
          progress={progress[item.id]}
          selected={item.id === selected}
          onSelect={() => onSelect(item)}
          onAdvance={() => onAdvance(item)}
          disabled={busy}
        />
      ))}
    </div>
  );
}
