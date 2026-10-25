'use client';

/** The error handler belongs to a client island, never to the RSC image props. */
export function AchievementIcon({ src }: { src: string }) {
  return <img src={src} alt="" aria-hidden="true" className="achievement-img"
    loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none'; }} />;
}
