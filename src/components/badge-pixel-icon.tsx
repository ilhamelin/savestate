const glyphs: Record<string, string> = {
  save: 'M2 2h10l2 2v10H2V2Zm3 0v5h6V2M5 14V9h6v5',
  broadcast: 'M2 5h12v9H2V5Zm3-4 3 4 3-4M6 8l4 2-4 2V8Z',
  coop: 'M2 7h12v6H2V7Zm2-4h3v3H4V3Zm5 0h3v3H9V3M4 10h3m-1.5-1.5v3M11 10h1',
  arcade: 'M3 1h10v14H3V1Zm2 2h6v6H5V3M5 12h3m-1.5-1.5v3M10 12h1',
  retro: 'M2 2h12v9H2V2Zm3 11h6M8 11v2M4 4h8v5H4V4',
  rpg: 'm3 13 9-9V1h3v3l-9 9M3 10l3 3M1 15l3-3',
  platinum: 'M5 1h6v7l-3 3-3-3V1ZM5 3H2v4l3 2m6-6h3v4l-3 2M8 11v3m-3 1h6',
};

export function BadgePixelIcon({ icon, size = 56 }: { icon: string; size?: number }) {
  return <svg viewBox="0 0 16 16" width={size} height={size} fill="none"
    stroke="currentColor" strokeWidth="1.5" shapeRendering="crispEdges" aria-hidden="true">
    <path d={glyphs[icon] ?? glyphs.save} />
  </svg>;
}
