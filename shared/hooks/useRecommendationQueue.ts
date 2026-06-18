import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRecommendations, type RecommendationResult } from "../api";
import { getActiveExcludedIds } from "../utils/rejections";
import { getSoftSkippedIds } from "../utils/softSkips";
import { hydrateRecommendation } from "../recommendationHydration";

// How many picks to keep hydrated ahead of the user so a swipe never waits on a
// fetch. The head is what's shown; the rest are pre-fetched + pre-hydrated.
export const QUEUE_TARGET = 3;

export interface QueueEntry {
  recommendation: RecommendationResult;
  place: mapkit.Place;
}

interface UseRecommendationQueueParams {
  latitude: number | undefined;
  longitude: number | undefined;
  enabled: boolean;
}

export interface RecommendationQueue {
  /** The pick currently being shown (buffer[0]), or null while filling. */
  head: QueueEntry | null;
  /** The next pick (buffer[1]) — used to render a stacked peek card. */
  peek: QueueEntry | null;
  /** A fetch is in flight to fill the buffer. */
  filling: boolean;
  /** The server has no more picks nearby AND the buffer is empty. */
  exhausted: boolean;
  /** Drop the current head and promote the next pick. */
  consume: () => void;
  /** Wipe the buffer (e.g. on location change / "Start over"). */
  reset: () => void;
}

// A client-side buffer of pre-fetched, pre-hydrated recommendations. The backend
// serves a batch of distinct picks per call, so the buffer is filled by asking
// for the current deficit (QUEUE_TARGET minus what's buffered) in one round-trip,
// excluding everything already buffered (plus the user's rejections/skips).
// Refilling runs in the background off the critical path, so promoting the next
// card on a swipe is instant.
export function useRecommendationQueue({
  latitude,
  longitude,
  enabled,
}: UseRecommendationQueueParams): RecommendationQueue {
  const [buffer, setBuffer] = useState<QueueEntry[]>([]);
  const [filling, setFilling] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  // Refs mirror state so the async fill loop reads fresh values without
  // re-subscribing, and so a reset can cancel an in-flight fill.
  const bufferRef = useRef<QueueEntry[]>([]);
  const fillingRef = useRef(false);
  const generationRef = useRef(0);
  const coordsRef = useRef<{ latitude?: number; longitude?: number }>({});
  coordsRef.current = { latitude, longitude };

  const commitBuffer = (next: QueueEntry[]) => {
    bufferRef.current = next;
    setBuffer(next);
  };

  const refill = useCallback(async () => {
    if (fillingRef.current) return;
    const { latitude: lat, longitude: lng } = coordsRef.current;
    if (lat === undefined || lng === undefined) return;
    const deficit = QUEUE_TARGET - bufferRef.current.length;
    if (deficit <= 0) return;

    fillingRef.current = true;
    setFilling(true);
    const gen = generationRef.current;

    try {
      const excludedPlaceIds = Array.from(
        new Set([
          ...getActiveExcludedIds(),
          ...getSoftSkippedIds(),
          ...bufferRef.current.map((e) => e.place.id),
        ])
      );

      let recs: RecommendationResult[];
      try {
        recs = await fetchRecommendations({
          latitude: lat,
          longitude: lng,
          excludedPlaceIds,
          limit: deficit,
        });
      } catch {
        // Transient network/server error — stop now, a later trigger retries.
        return;
      }
      if (gen !== generationRef.current) return; // reset happened mid-flight

      if (!recs.length) {
        // Nothing left nearby. Only "exhausted" if we have nothing to show.
        setExhausted(bufferRef.current.length === 0);
        return;
      }

      // Hydrate sequentially, committing each so the head card shows as soon as
      // it's ready rather than waiting on the whole batch.
      for (const rec of recs) {
        const place = await hydrateRecommendation(rec);
        if (gen !== generationRef.current) return;
        setExhausted(false);
        commitBuffer([...bufferRef.current, { recommendation: rec, place }]);
      }
    } finally {
      if (gen === generationRef.current) {
        fillingRef.current = false;
        setFilling(false);
      }
    }
  }, []);

  const consume = useCallback(() => {
    commitBuffer(bufferRef.current.slice(1));
    void refill();
  }, [refill]);

  const reset = useCallback(() => {
    generationRef.current += 1; // cancel any in-flight fill
    fillingRef.current = false;
    commitBuffer([]);
    setFilling(false);
    setExhausted(false);
    // Start a fresh fill immediately rather than waiting on the topping-up
    // effect. That effect only fires when its deps change, so clearing an
    // already-empty buffer (e.g. on the initial location lock, where reset
    // cancels the queue's very first fill) wouldn't restart fetching and the
    // app would hang on the loading screen. consume() refills the same way.
    void refill();
  }, [refill]);

  // Keep the buffer topped up whenever it drops below target.
  useEffect(() => {
    if (!enabled) return;
    if (exhausted) return;
    if (buffer.length >= QUEUE_TARGET) return;
    void refill();
  }, [enabled, exhausted, buffer.length, latitude, longitude, refill]);

  return {
    head: buffer[0] ?? null,
    peek: buffer[1] ?? null,
    filling,
    exhausted,
    consume,
    reset,
  };
}
