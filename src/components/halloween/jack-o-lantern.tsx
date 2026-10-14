export function JackOLantern({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const pixels = { sm: 18, md: 32, lg: 48 }[size];
  return (
    <svg
      className={`jack-o-lantern jack-o-lantern-${size}`}
      viewBox="0 0 64 64"
      width={pixels}
      height={pixels}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M29 17q-3-10 5-14l5 4q-8 3-6 11" fill="#76643a" />
      <path
        d="M32 18C9 5-5 35 10 53q9 10 22 4 13 6 22-4C69 35 55 5 32 18Z"
        fill="#7c3211"
        stroke="#c35b18"
        strokeWidth="2"
      />
      <path
        d="M26 18C12 29 16 48 25 56M38 18c14 11 10 30 1 38"
        fill="none"
        stroke="#4d200e"
        strokeWidth="2"
      />
      <g className="pumpkin-glow" fill="#ff7700">
        <path d="m13 29 13 9-15 1Zm38 0 2 10-15-1ZM32 34l-5 9h10Z" />
        <path d="m13 44 10 5 2-4 6 6 5-6 4 4 11-5-6 10-8 3-6-3-7 2-7-5Z" />
      </g>
    </svg>
  );
}
