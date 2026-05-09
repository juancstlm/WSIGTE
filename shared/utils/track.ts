declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, unknown>) => void;
    };
  }
}

export function track(
  eventName: string,
  eventData?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  try {
    window.umami?.track(eventName, eventData);
  } catch {}
}
