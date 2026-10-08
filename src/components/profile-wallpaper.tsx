import type { ReactNode } from 'react';
export function ProfileWallpaper({ url, children }: { url?: string | null; children: ReactNode }) {
  return (
    <div className={`profile-wallpaper ${url ? 'has-wallpaper' : ''}`}>
      {/* A decorative image avoids injecting an untrusted URL into CSS. */}
      {url ? <img className="wallpaper-image" src={url} alt="" aria-hidden="true" /> : null}
      <div className="wallpaper-content">{children}</div>
    </div>
  );
}
