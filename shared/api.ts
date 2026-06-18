const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

export interface ApiErrorDetail {
  field?: string;
  message?: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

export class ApiError extends Error {
  status: number | string;
  code?: string;
  details?: ApiErrorDetail[];
  constructor(
    status: number | string,
    message?: string,
    opts: { code?: string; details?: ApiErrorDetail[] } = {}
  ) {
    super(message ?? `API error ${status}`);
    this.status = status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

async function readApiError(
  res: Response,
  fallbackMessage: string
): Promise<ApiError> {
  try {
    const data = await res.clone().json();
    const err: ApiErrorPayload | undefined = data?.error;
    if (err && typeof err === "object" && typeof err.code === "string") {
      return new ApiError(res.status, err.message || fallbackMessage, {
        code: err.code,
        details: err.details,
      });
    }
  } catch {
    // not JSON, fall through
  }
  return new ApiError(res.status, fallbackMessage);
}

export type HealthResult = { ok: true } | { ok: false; status: number | string };

// Hits /ready, which verifies DB connectivity. /health is now pure liveness.
export async function fetchHealth(): Promise<HealthResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/ready`, { cache: "no-store" });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true };
  } catch {
    return { ok: false, status: 503 };
  }
}

export interface TokenResponse {
  token: string;
  expiresAt: string;
  ttl: number;
}

export async function fetchToken(): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE_URL}/v1/token`);
  if (!res.ok) throw await readApiError(res, "token fetch failed");
  const data = (await res.json()) as Partial<TokenResponse>;
  if (
    !data ||
    typeof data.token !== "string" ||
    typeof data.expiresAt !== "string" ||
    typeof data.ttl !== "number"
  ) {
    throw new ApiError(res.status, "token response is malformed");
  }
  return data as TokenResponse;
}

// Values are arbitrary strings. Use "true"/"false" for boolean-style flags,
// or any other value for variant flags (e.g. "v2", "blue").
export type FeatureFlags = Record<string, string>;

export async function fetchFeatureFlags(): Promise<FeatureFlags> {
  const res = await fetch(`${API_BASE_URL}/v1/feature-flags`);
  if (!res.ok) throw await readApiError(res, "feature-flags fetch failed");
  const data = await res.json();
  if (!data || typeof data !== "object") return {};
  const out: FeatureFlags = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export interface HoursSlot {
  day: number; // Mon=0..Sun=6 (Yelp's convention)
  start: string; // "HHMM" 24h, in the place's local time
  end: string;
  isOvernight: boolean;
}

export interface PlaceEnrichment {
  categoryDisplayName: string | null;
  rating: number | null;
  priceLevel: string | null;
  openNow: boolean | null;
  hours: HoursSlot[] | null;
  yelpUrl: string | null;
  phone: string | null;
  photoUrl: string | null;
  // Up to 3 Yelp photo URLs (includes photoUrl). Empty when Yelp has no match.
  photos: string[];
}

export interface SharedPlace extends PlaceEnrichment {
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
  if (!res.ok) throw await readApiError(res, "shared place not found");
  return (await res.json()) as SharedPlace;
}

export interface CreatePlaceBody {
  appleMapsPlaceId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface RecommendationResult extends PlaceEnrichment {
  appleMapsPlaceId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  blurb?: string;
  source: "top_pick" | "mapkit";
}

export interface FetchRecommendationParams {
  latitude: number;
  longitude: number;
  excludedPlaceIds: string[];
  // How many distinct picks to fetch in one call (fills the card stack). Default 1.
  limit?: number;
}

function parseRecommendation(
  r: Partial<RecommendationResult> | undefined | null
): RecommendationResult | null {
  if (
    !r ||
    typeof r.appleMapsPlaceId !== "string" ||
    typeof r.name !== "string" ||
    typeof r.latitude !== "number" ||
    typeof r.longitude !== "number"
  ) {
    return null;
  }
  return {
    appleMapsPlaceId: r.appleMapsPlaceId,
    name: r.name,
    address: typeof r.address === "string" ? r.address : "",
    latitude: r.latitude,
    longitude: r.longitude,
    blurb: typeof r.blurb === "string" ? r.blurb : undefined,
    source: r.source === "top_pick" ? "top_pick" : "mapkit",
    ...readEnrichment(r),
  };
}

// Returns a batch of recommendations (up to `limit`). Empty array when the server
// replies 404 ("no recommendations available" — e.g. nothing within ~60 mi after
// excluding what the user already rejected). Other errors throw ApiError.
// Falls back to the legacy single `recommendation` field if `recommendations` is
// absent, so it works against both old and new server builds.
export async function fetchRecommendations(
  params: FetchRecommendationParams
): Promise<RecommendationResult[]> {
  const res = await fetch(`${API_BASE_URL}/v1/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw await readApiError(res, "recommendation fetch failed");
  const data = (await res.json()) as {
    recommendations?: Array<Partial<RecommendationResult>>;
    recommendation?: Partial<RecommendationResult>;
  };
  const raw = Array.isArray(data?.recommendations)
    ? data.recommendations
    : data?.recommendation
      ? [data.recommendation]
      : [];
  const parsed = raw
    .map(parseRecommendation)
    .filter((r): r is RecommendationResult => r !== null);
  if (raw.length && !parsed.length) {
    throw new ApiError(res.status, "recommendation response is malformed");
  }
  return parsed;
}

function readEnrichment(r: Partial<PlaceEnrichment>): PlaceEnrichment {
  return {
    categoryDisplayName: typeof r.categoryDisplayName === "string" ? r.categoryDisplayName : null,
    rating: typeof r.rating === "number" ? r.rating : null,
    priceLevel: typeof r.priceLevel === "string" ? r.priceLevel : null,
    openNow: typeof r.openNow === "boolean" ? r.openNow : null,
    hours: Array.isArray(r.hours) ? r.hours.filter(isHoursSlot) : null,
    yelpUrl: typeof r.yelpUrl === "string" ? r.yelpUrl : null,
    phone: typeof r.phone === "string" ? r.phone : null,
    photoUrl: typeof r.photoUrl === "string" ? r.photoUrl : null,
    photos: Array.isArray(r.photos)
      ? r.photos.filter((p): p is string => typeof p === "string")
      : [],
  };
}

function isHoursSlot(v: unknown): v is HoursSlot {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.day === "number" &&
    typeof s.start === "string" &&
    typeof s.end === "string" &&
    typeof s.isOvernight === "boolean"
  );
}

export interface CreateSharedPlaceResult {
  shortId: string;
  created: boolean;
}

export async function createSharedPlace(
  body: CreatePlaceBody
): Promise<CreateSharedPlaceResult> {
  const res = await fetch(`${API_BASE_URL}/v1/places`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readApiError(res, "place create failed");
  const data = (await res.json()) as Partial<CreateSharedPlaceResult>;
  return {
    shortId: String(data?.shortId ?? ""),
    created: data?.created === true,
  };
}
