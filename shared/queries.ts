import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { track } from "./utils";

import {
  fetchFeatureFlags,
  fetchHealth,
  fetchRecommendation,
  fetchSharedPlace,
  fetchToken,
  createSharedPlace,
} from "./api";
import { getActiveExcludedIds } from "./utils/rejections";
import { getSoftSkippedIds } from "./utils/softSkips";

const PLACES_COORD_PRECISION = 3;
const roundCoord = (n: number) =>
  Math.round(n * 10 ** PLACES_COORD_PRECISION) / 10 ** PLACES_COORD_PRECISION;

const TOKEN_CACHE_KEY = "wsigte_mapkit_token";
const TOKEN_EXPIRY_BUFFER_MS = 30_000;

interface CachedToken {
  token: string;
  expiresAt: string; // ISO 8601
}

function getCachedToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedToken = JSON.parse(raw);
    if (
      cached &&
      typeof cached.token === "string" &&
      typeof cached.expiresAt === "string"
    ) {
      const expiry = Date.parse(cached.expiresAt);
      if (Number.isFinite(expiry) && expiry - TOKEN_EXPIRY_BUFFER_MS > Date.now()) {
        return cached.token;
      }
    }
  } catch {}
  try {
    localStorage.removeItem(TOKEN_CACHE_KEY);
  } catch {}
  return null;
}

export function useHealthQuery() {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useTokenQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["mapkit-token"],
    queryFn: async () => {
      const cached = getCachedToken();
      if (cached) return cached;
      const { token, expiresAt } = await fetchToken();
      try {
        const entry: CachedToken = { token, expiresAt };
        localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(entry));
      } catch {}
      return token;
    },
    enabled,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useFeatureFlagsQuery() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: fetchFeatureFlags,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// Returns the raw string value of a flag, or undefined if the flag isn't set.
// For variant/multi-value flags, branch on this return value directly.
export function useFeatureFlagValue(name: string): string | undefined {
  const { data } = useFeatureFlagsQuery();
  return data?.[name];
}

// Boolean shortcut: true only when the flag's string value is exactly "true".
export function useFeatureFlag(name: string): boolean {
  return useFeatureFlagValue(name) === "true";
}

export function useFeatureFlagsExposure() {
  const { data } = useFeatureFlagsQuery();
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current || !data) return;
    reported.current = true;
    track("feature_flags_loaded", data);
  }, [data]);
}

export function useSharedPlaceQuery(id: string | undefined) {
  return useQuery({
    queryKey: ["shared-place", id],
    queryFn: () => fetchSharedPlace(id!),
    enabled: typeof id === "string" && id.length > 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

interface UseRecommendationParams {
  latitude: number | undefined;
  longitude: number | undefined;
  enabled: boolean;
  // Refetch cursor — bumped by either a hard reject or a soft skip so React
  // Query re-runs the call with a fresh excluded list. The list itself is
  // read inside queryFn (persistent rejections from localStorage, session
  // soft-skips from memory) so it never gets serialized into the cache key.
  rejectionVersion: number;
}

export function useRecommendationQuery({
  latitude,
  longitude,
  enabled,
  rejectionVersion,
}: UseRecommendationParams) {
  const lat = latitude !== undefined ? roundCoord(latitude) : undefined;
  const lng = longitude !== undefined ? roundCoord(longitude) : undefined;
  return useQuery({
    queryKey: ["recommendation", lat, lng, rejectionVersion],
    queryFn: () =>
      fetchRecommendation({
        latitude: lat!,
        longitude: lng!,
        excludedPlaceIds: Array.from(
          new Set([...getActiveExcludedIds(), ...getSoftSkippedIds()])
        ),
      }),
    enabled: enabled && lat !== undefined && lng !== undefined,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useCreateSharedPlaceMutation() {
  return useMutation({
    mutationFn: createSharedPlace,
  });
}
