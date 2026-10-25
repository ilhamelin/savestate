'use client';
import { useEffect, useRef } from 'react';

/** Image failures can occur before hydration; cover both cached and future errors. */
export function AchievementIcon({ src }: { src: string }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const element = image.current;
    if (element)
      element.style.display = element.complete && element.naturalWidth === 0 ? 'none' : '';
  }, [src]);
  return (
    <img
      ref={image}
      src={src}
      alt=""
      aria-hidden="true"
      className="achievement-img"
      loading="lazy"
      decoding="async"
      onError={(event) => {
        event.currentTarget.style.display = 'none';
      }}
    />
  );
}
