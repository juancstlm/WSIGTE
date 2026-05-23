// In-session soft-skip set. Lives only in memory; resets on page reload.
// Soft skips carry no growing-TTL penalty — they just keep the server from
// handing back the same place during this session. For persistent rejections
// with a growing TTL, see ./rejections.ts.

let softSkipped = new Set<string>();

export function recordSoftSkip(placeId: string): void {
  if (placeId) softSkipped.add(placeId);
}

export function getSoftSkippedIds(): string[] {
  return Array.from(softSkipped);
}

export function clearSoftSkips(): void {
  softSkipped = new Set<string>();
}
