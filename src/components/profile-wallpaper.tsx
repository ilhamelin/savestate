import type { ReactNode } from 'react';
export function ProfileWallpaper({
  url,
  children,
  fullScreen = false,
}: {
  url?: string | null;
  children: ReactNode;
  fullScreen?: boolean;
}) {
  return (
    <div
      className={`profile-wallpaper ${url ? 'has-wallpaper' : ''} ${fullScreen ? 'profile-wallpaper-fullscreen' : ''}`}
    >
      {/* A decorative image avoids injecting an untrusted URL into CSS. */}
      {url ? (
        <div className="wallpaper-backdrop" aria-hidden="true">
          <img className="wallpaper-image" src={url} alt="" />
        </div>
      ) : null}
      <div className="wallpaper-content">{children}</div>
    </div>
  );
}
