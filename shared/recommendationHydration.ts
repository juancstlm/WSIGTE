import type { RecommendationResult } from "./api";

// Adapts the server's slim payload into a mapkit.Place-shaped object so the
// rest of the UI (ResultScreen, ShareScreen) keeps working unchanged. Only the
// fields actually read downstream are populated; the synthetic object is not a
// real MapKit-internal Place and should not be passed to MapKit APIs that
// expect one (use raw coordinates for Directions instead).
export function toPlace(rec: RecommendationResult): mapkit.Place {
  return {
    id: rec.appleMapsPlaceId,
    name: rec.name,
    formattedAddress: rec.address,
    coordinate: { latitude: rec.latitude, longitude: rec.longitude },
    telephone: undefined,
    urls: [],
  } as unknown as mapkit.Place;
}

// Hydrate a recommendation (phone, urls) via MapKit's PlaceLookup before we
// reveal it. The server's payload only carries name/address/coords because the
// Apple Maps Server API doesn't expose contact info. Falls back to the slim
// payload if PlaceLookup is unavailable, errors, or hangs past `timeoutMs`.
// Assumes the mapkit global is loaded (callers gate on `mapkitReady`).
export function hydrateRecommendation(
  rec: RecommendationResult,
  timeoutMs = 4000
): Promise<mapkit.Place> {
  return new Promise((resolve) => {
    const fallback = toPlace(rec);
    let settled = false;
    const finish = (place: mapkit.Place) => {
      if (settled) return;
      settled = true;
      resolve(place);
    };

    const timeoutId = setTimeout(() => finish(fallback), timeoutMs);

    const PlaceLookupCtor = (mapkit as unknown as {
      PlaceLookup?: new () => {
        getPlace: (
          id: string,
          cb: (e: Error | null, p: mapkit.Place | null) => void
        ) => void;
      };
    }).PlaceLookup;

    if (!PlaceLookupCtor) {
      clearTimeout(timeoutId);
      finish(fallback);
      return;
    }

    new PlaceLookupCtor().getPlace(rec.appleMapsPlaceId, (error, hydrated) => {
      clearTimeout(timeoutId);
      if (error || !hydrated) {
        if (error) console.warn("Place lookup failed, using slim payload:", error);
        finish(fallback);
        return;
      }
      finish(hydrated);
    });
  });
}
