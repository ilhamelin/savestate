export const SYSTEM_STATUS_INTERVAL_MS = 30_000;
export const SYSTEM_STATUS_MAX_BACKOFF_MS = 120_000;
export const SYSTEM_STATUS_TIMEOUT_MS = 8_000;

interface PollingOptions {
  refresh: (signal: AbortSignal) => Promise<void>;
  isActive: () => boolean;
  schedule: (callback: () => void, delay: number) => () => void;
}

/** A completion-based scheduler: one request or timer at a time, suspended while inactive. */
export function startSystemStatusPolling({ refresh, isActive, schedule }: PollingOptions) {
  let stopped = false;
  let running = false;
  let failures = 0;
  let resumeRequested = false;
  let controller: AbortController | null = null;
  let cancelTimer: (() => void) | null = null;

  function clearTimer() {
    cancelTimer?.();
    cancelTimer = null;
  }

  async function run() {
    if (stopped || running || !isActive()) return;
    clearTimer();
    running = true;
    const request = new AbortController();
    controller = request;
    try {
      await refresh(request.signal);
      if (!request.signal.aborted) failures = 0;
    } catch {
      if (!request.signal.aborted) failures = Math.min(failures + 1, 2);
    } finally {
      running = false;
      controller = null;
      if (!stopped && isActive()) {
        if (resumeRequested) {
          resumeRequested = false;
          void run();
        } else {
          const delay = Math.min(
            SYSTEM_STATUS_INTERVAL_MS * 2 ** failures,
            SYSTEM_STATUS_MAX_BACKOFF_MS,
          );
          cancelTimer = schedule(() => {
            cancelTimer = null;
            void run();
          }, delay);
        }
      }
    }
  }

  function wake() {
    if (stopped) return;
    clearTimer();
    if (!isActive()) {
      resumeRequested = false;
      controller?.abort();
      return;
    }
    if (running) {
      resumeRequested = Boolean(controller?.signal.aborted);
      return;
    }
    void run();
  }

  wake();
  return {
    wake,
    stop() {
      stopped = true;
      resumeRequested = false;
      clearTimer();
      controller?.abort();
    },
  };
}
