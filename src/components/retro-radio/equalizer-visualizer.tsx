'use client';
import { useEffect, useRef } from 'react';

export function EqualizerVisualizer({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const bars = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const elements = bars.current?.querySelectorAll<HTMLElement>('.radio-eq-bar');
    if (!elements) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame: number | null = null, previous = 0;
    const samples = new Uint8Array(analyser?.frequencyBinCount ?? 32);
    function reset() { elements!.forEach(element => element.style.transform = 'scaleY(0.2)'); }
    function stop() { if (frame !== null) cancelAnimationFrame(frame); frame = null; reset(); }
    function draw(time: number) {
      if (!active || !analyser || query.matches || document.hidden) { stop(); return; }
      if (time - previous >= 32) {
        previous = time;
        analyser.getByteFrequencyData(samples);
        elements!.forEach((element, index) => {
          const value = samples[Math.min(samples.length - 1, index * 3 + 1)] ?? 0;
          element.style.transform = 'scaleY(' + Math.max(0.08, value / 255) + ')';
        });
      }
      frame = requestAnimationFrame(draw);
    }
    function sync() { stop(); if (active && analyser && !query.matches && !document.hidden) frame = requestAnimationFrame(draw); }
    query.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { stop(); query.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); };
  }, [active, analyser]);
  return <span ref={bars} className="radio-equalizer" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <span key={i} className="radio-eq-bar" />)}</span>;
}
