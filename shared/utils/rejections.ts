// Local rejection store. Persists which places the user has hit "That's awful"
// on, with a growing TTL — repeated rejections keep a place out of rotation
// for longer. The server is stateless about rejections; we send the active
// excluded ids on each /v1/recommendations call.

const STORAGE_KEY = "wsigte_rejections";

const DAY_MS = 24 * 60 * 60 * 1000;

// Growing-TTL schedule. Index n is the TTL after the (n+1)th rejection.
const TTL_MS_BY_COUNT = [
  1 * DAY_MS,   // 1 reject → 1 day
  3 * DAY_MS,   // 2 → 3 days
  7 * DAY_MS,   // 3 → 7 days
  14 * DAY_MS,  // 4 → 14 days
  30 * DAY_MS,  // 5+ → 30 days
];

interface RejectionEntry {
  count: number;
  lastRejectedAt: string; // ISO
}

type RejectionStore = Record<string, RejectionEntry>;

function ttlFor(count: number): number {
  if (count <= 0) return 0;
  return TTL_MS_BY_COUNT[Math.min(count, TTL_MS_BY_COUNT.length) - 1];
}

function read(): RejectionStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as RejectionStore;
  } catch {}
  return {};
}

function write(store: RejectionStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

export function recordRejection(placeId: string): void {
  if (!placeId) return;
  const store = read();
  const prev = store[placeId];
  store[placeId] = {
    count: (prev?.count ?? 0) + 1,
    lastRejectedAt: new Date().toISOString(),
  };
  write(store);
}

// Returns ids whose TTL hasn't elapsed. Prunes expired entries as a side effect.
export function getActiveExcludedIds(now: number = Date.now()): string[] {
  const store = read();
  const active: string[] = [];
  let pruned = false;
  for (const [id, entry] of Object.entries(store)) {
    const rejectedAt = Date.parse(entry.lastRejectedAt);
    if (!Number.isFinite(rejectedAt)) {
      delete store[id];
      pruned = true;
      continue;
    }
    if (rejectedAt + ttlFor(entry.count) > now) {
      active.push(id);
    } else {
      delete store[id];
      pruned = true;
    }
  }
  if (pruned) write(store);
  return active;
}

export function clearRejections(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
