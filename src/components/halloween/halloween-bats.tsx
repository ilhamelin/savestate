'use client';

export function HalloweenBats() {
  return (
    <div className="halloween-bats-layer" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((bat) => (
        <div className={`bat bat-${bat}`} key={bat}>
          <svg viewBox="0 0 80 36" focusable="false">
            <path
              className="bat-wing bat-wing-left"
              d="M40 15 25 4 2 1 9 16 17 13 23 25 31 21 39 30Z"
            />
            <path
              className="bat-wing bat-wing-right"
              d="M40 15 55 4 78 1 71 16 63 13 57 25 49 21 41 30Z"
            />
            <path d="m34 8 3 4h6l3-4 1 14-7 12-7-12Z" />
          </svg>
        </div>
      ))}
    </div>
  );
}
