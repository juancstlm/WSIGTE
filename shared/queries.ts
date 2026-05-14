import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { track } from "./utils";

import {
  fetchFeatureFlags,
  fetchHealth,
  fetchSharedPlace,
  fetchToken,
  createSharedPlace,
  searchPlacesToEat,
} from "./api";

const PLACES_COORD_PRECISION = 3;
const roundCoord = (n: number) =>
  Math.round(n * 10 ** PLACES_COORD_PRECISION) / 10 ** PLACES_COORD_PRECISION;

const TOKEN_CACHE_KEY = "wsigte_mapkit_token";
const TOKEN_EXPIRY_BUFFER_S = 30;

function getCachedToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(TOKEN_CACHE_KEY);
    if (!cached) return null;
    const payload = JSON.parse(atob(cached.split(".")[1]));
    if (payload.exp - TOKEN_EXPIRY_BUFFER_S > Date.now() / 1000) return cached;
  } catch {}
  localStorage.removeItem(TOKEN_CACHE_KEY);
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
      const jwt = await fetchToken();
      try {
        localStorage.setItem(TOKEN_CACHE_KEY, jwt);
      } catch {}
      return jwt;
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

export function useFeatureFlag(name: string): boolean {
  const { data } = useFeatureFlagsQuery();
  return data?.[name] === true;
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

interface UseSearchPlacesParams {
  latitude: number | undefined;
  longitude: number | undefined;
  enabled: boolean;
}

export function useSearchPlacesQuery({
  latitude,
  longitude,
  enabled,
}: UseSearchPlacesParams) {
  const lat = latitude !== undefined ? roundCoord(latitude) : undefined;
  const lng = longitude !== undefined ? roundCoord(longitude) : undefined;
  return useQuery({
    queryKey: ["places-search", lat, lng],
    queryFn: () => searchPlacesToEat({ latitude: lat!, longitude: lng! }),
    enabled: enabled && lat !== undefined && lng !== undefined,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useCreateSharedPlaceMutation() {
  return useMutation({
    mutationFn: createSharedPlace,
  });
}
