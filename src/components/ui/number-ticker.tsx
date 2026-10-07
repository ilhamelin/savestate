'use client';
import { useEffect, useRef } from 'react';
import { visibleAnimation } from '@/lib/visible-animation';
export function NumberTicker({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const output = useRef<HTMLSpanElement>(null);
  const target = Number.isFinite(value) ? value : 0;
  const precision = Number.isInteger(decimals) ? Math.max(0, Math.min(2, decimals)) : 0;
  const final = target.toFixed(precision);
  useEffect(() => {
    const node = output.current;
    if (!node) return;
    return visibleAnimation(
      node,
      (progress) => {
        const eased = 1 - Math.pow(1 - progress, 3);
        node.textContent = progress === 1 ? final : (target * eased).toFixed(precision);
      },
      target === 0 ? 0 : 800,
    );
  }, [target, precision, final]);
  return (
    <span className="number-ticker">
      <span className="sr-only motion-static">{final}</span>
      <span className="motion-animated" aria-hidden="true" ref={output}>
        {final}
      </span>
    </span>
  );
}
