export function visibleAnimation(
  element: HTMLElement,
  render: (progress: number) => void,
  duration: number,
  interval = 0,
) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0,
    finished = false,
    started = false;
  let observer: IntersectionObserver | undefined;
  function finish() {
    finished = true;
    window.cancelAnimationFrame(frame);
    observer?.disconnect();
    render(1);
  }
  function preferenceChanged() {
    if (media.matches) finish();
  }
  function start() {
    if (finished || started) return;
    started = true;
    observer?.disconnect();
    let startTime: number | undefined;
    let lastPaint = -Infinity;
    function tick(time: number) {
      if (finished) return;
      startTime ??= time;
      const progress = Math.min(1, (time - startTime) / duration);
      if (progress === 1) {
        finish();
        return;
      }
      if (time - lastPaint >= interval) {
        render(progress);
        lastPaint = time;
      }
      frame = window.requestAnimationFrame(tick);
    }
    frame = window.requestAnimationFrame(tick);
  }
  media.addEventListener('change', preferenceChanged);
  if (media.matches || !Number.isFinite(duration) || duration <= 0) finish();
  else if (typeof window.IntersectionObserver === 'function') {
    observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) start();
      },
      { threshold: 0.1 },
    );
    observer.observe(element);
  } else start();
  return () => {
    finished = true;
    window.cancelAnimationFrame(frame);
    observer?.disconnect();
    media.removeEventListener('change', preferenceChanged);
  };
}
