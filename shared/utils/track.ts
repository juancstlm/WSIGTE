declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, unknown>) => void;
    };
  }
}

type QueuedEvent = [string, Record<string, unknown> | undefined];
const queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function flushQueue() {
  if (typeof window === "undefined" || !window.umami) return;
  while (queue.length) {
    const [name, data] = queue.shift()!;
    try {
      window.umami.track(name, data);
    } catch {}
  }
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

export function track(
  eventName: string,
  eventData?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  if (window.umami) {
    try {
      window.umami.track(eventName, eventData);
    } catch {}
    return;
  }
  queue.push([eventName, eventData]);
  if (!flushTimer) {
    flushTimer = setInterval(flushQueue, 250);
    setTimeout(() => {
      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
        queue.length = 0;
      }
    }, 10000);
  }
}
