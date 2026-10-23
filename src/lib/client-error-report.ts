import { redactTelemetry, supportPath } from '@/domain/support-ticket';
const recent = new Map<string, number>();
export function reportClientError(error: Error, pathname: string) {
  if (
    typeof window === 'undefined' ||
    !navigator.onLine ||
    pathname.startsWith('/guardian') ||
    pathname.startsWith('/gatekeeper')
  )
    return;
  const message = redactTelemetry(error.message || 'Unknown error').slice(0, 500);
  const path = supportPath(pathname);
  const key = message + path;
  const now = Date.now();
  if (now - (recent.get(key) ?? 0) < 60000) return;
  recent.set(key, now);
  if (recent.size > 50) recent.delete(recent.keys().next().value!);
  const payload = JSON.stringify({
    message,
    stack: redactTelemetry(error.stack ?? '').slice(0, 1500),
    pathname: path,
    userAgent: navigator.userAgent.slice(0, 300),
  });
  try {
    const blob = new Blob([payload], { type: 'application/json' });
    if (navigator.sendBeacon?.('/api/telemetry/errors', blob)) return;
    void fetch('/api/telemetry/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* Telemetry must never interrupt the app. */
  }
}
