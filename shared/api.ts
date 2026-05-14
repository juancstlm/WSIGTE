const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

export class ApiError extends Error {
  status: number | string;
  constructor(status: number | string, message?: string) {
    super(message ?? `API error ${status}`);
    this.status = status;
  }
}

export type HealthResult = { ok: true } | { ok: false; status: number | string };

export async function fetchHealth(): Promise<HealthResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
    if (!res.ok) return { ok: false, status: res.status };
    const body = (await res.text()).trim().toLowerCase();
    if (!body) return { ok: true };
    try {
      const parsed = JSON.parse(body);
      const status = String(parsed?.status ?? "").toLowerCase();
      if (status === "down") return { ok: false, status: 503 };
    } catch {
      if (body === "down") return { ok: false, status: 503 };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 503 };
  }
}

export async function fetchToken(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/v1/token`);
  if (!res.ok) throw new ApiError(res.status, "token fetch failed");
  return (await res.text()).trim();
}

export type FeatureFlags = Record<string, boolean>;

export async function fetchFeatureFlags(): Promise<FeatureFlags> {
  const res = await fetch(`${API_BASE_URL}/v1/feature-flags`, { cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status, "feature-flags fetch failed");
  const data = await res.json();
  return data && typeof data === "object" ? (data as FeatureFlags) : {};
}

export interface SharedPlace {
  shortId: string;
  appleMapsPlaceId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

export async function fetchSharedPlace(id: string): Promise<SharedPlace> {
  const res = await fetch(`${API_BASE_URL}/v1/places/${id}`);
  if (!res.ok) throw new ApiError(res.status, "shared place not found");
  return (await res.json()) as SharedPlace;
}

export interface CreatePlaceBody {
  appleMapsPlaceId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface PlacesSearchParams {
  latitude: number;
  longitude: number;
  spanDegrees?: number;
}

export function searchPlacesToEat({
  latitude,
  longitude,
  spanDegrees = 1,
}: PlacesSearchParams): Promise<mapkit.Place[]> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.mapkit?.Search) {
      reject(new Error("MapKit is not loaded"));
      return;
    }

    const region = new mapkit.CoordinateRegion(
      new mapkit.Coordinate(latitude, longitude),
      new mapkit.CoordinateSpan(spanDegrees, spanDegrees)
    );

    const filters = mapkit.PointOfInterestFilter.including([
      mapkit.PointOfInterestCategory.Bakery,
      mapkit.PointOfInterestCategory.Cafe,
      mapkit.PointOfInterestCategory.Restaurant,
    ]);

    const search = new mapkit.Search({
      region,
      getsUserLocation: true,
      language: "en-US",
      pointOfInterestFilter: filters,
    });

    search.search("Food", (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data.places ?? []);
    });
  });
}

export async function createSharedPlace(
  body: CreatePlaceBody
): Promise<{ shortId: string }> {
  const res = await fetch(`${API_BASE_URL}/v1/places`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, "place create failed");
  return (await res.json()) as { shortId: string };
}
