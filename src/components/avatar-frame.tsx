import type { ReactNode } from 'react';
import { AVATAR_FRAMES, type AvatarFrame as Frame } from '@/domain/progression';

export function AvatarFrame({
  frame = 'default',
  children,
}: {
  frame?: Frame;
  children: ReactNode;
}) {
  const safe = AVATAR_FRAMES.find((item) => item.id === frame)?.id ?? 'default';
  return (
    <div className={`avatar-container frame-${safe}`}>
      {children}
      <span className="frame-overlay" aria-hidden="true" />
    </div>
  );
}
