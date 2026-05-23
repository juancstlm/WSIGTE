import { track } from "./track";

type Entry = "home" | "shared_place" | "other";

type Counter =
  | "searches"
  | "picksShown"
  | "picksRejected"
  | "picksSkipped"
  | "tookDirections"
  | "sharedPlaceViewed";

const counters: Record<Counter, number> = {
  searches: 0,
  picksShown: 0,
  picksRejected: 0,
  picksSkipped: 0,
  tookDirections: 0,
  sharedPlaceViewed: 0,
};

let started = false;
let flushed = false;

function detectEntry(pathname: string): Entry {
  if (pathname === "/" || pathname === "") return "home";
  if (pathname.startsWith("/p/")) return "shared_place";
  return "other";
}

function readUtms(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const out: Record<string, string> = {};
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ]) {
    const value = params.get(key);
    if (value) out[key] = value;
  }
  return out;
}

export function bump(counter: Counter) {
  counters[counter] += 1;
}

export function flushSummary() {
  if (!started || flushed) return;
  flushed = true;
  track("session_summary", { ...counters });
}

export function startSession() {
  if (typeof window === "undefined" || started) return;
  started = true;

  const entry = detectEntry(window.location.pathname);
  const utms = readUtms(window.location.search);
  track("session_start", { entry, ...utms });

  const handleHide = () => {
    if (document.visibilityState === "hidden") flushSummary();
  };
  document.addEventListener("visibilitychange", handleHide);
  window.addEventListener("pagehide", flushSummary);
}
