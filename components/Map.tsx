import { useState, useRef, useEffect, useCallback } from "react";
import {
  Map as MapKitMap,
} from "mapkit-react";
import type {
  Coordinate,
  UserLocationChangeEvent,
  UserLocationErrorEvent,
} from "mapkit-react";

import { STATUS } from "../types";

const MIN_LOADING_MS = 3000;
const REJECT_OVERLAY_MS = 1700;
const SKIP_OVERLAY_MS = 900;
import { useFeatureFlagsExposure, useRecommendationQuery } from "../shared/queries";
import { bumpSession, track } from "../shared/utils";
import { recordRejection } from "../shared/utils/rejections";
import { recordSoftSkip } from "../shared/utils/softSkips";
import { REJECTIONS, SOFT_SKIP_LINES, TOP_PICK_REJECTIONS } from "../shared/constants";
import type { RecommendationResult } from "../shared/api";
import { Header } from "./Header";
import { LoadingScreen } from "./LoadingScreen";
import { NotFoundScreen } from "./NotFoundScreen";
import { ResultScreen } from "./ResultScreen";
import { ShareScreen } from "./ShareScreen";

interface MapProps {
  token: string;
}

type Screen = "loading" | "notfound" | "result" | "share";

// Adapts the server's slim payload into a mapkit.Place-shaped object so the
// rest of the UI (ResultScreen, ShareScreen) keeps working unchanged. Only the
// fields actually read downstream are populated; the synthetic object is not a
// real MapKit-internal Place and should not be passed to MapKit APIs that
// expect one (use raw coordinates for Directions instead).
function toPlace(rec: RecommendationResult): mapkit.Place {
  return {
    id: rec.appleMapsPlaceId,
    name: rec.name,
    formattedAddress: rec.address,
    coordinate: { latitude: rec.latitude, longitude: rec.longitude },
    telephone: undefined,
    urls: [],
  } as unknown as mapkit.Place;
}

function fitMapToPoints(
  map: mapkit.Map,
  points: Array<{ latitude: number; longitude: number }>
) {
  if (points.length === 0) return;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }

  const latPadding = Math.max((maxLat - minLat) * 0.4, 0.005);
  const lngPadding = Math.max((maxLng - minLng) * 0.4, 0.005);

  map.setRegionAnimated(
    new mapkit.CoordinateRegion(
      new mapkit.Coordinate(
        (minLat + maxLat) / 2,
        (minLng + maxLng) / 2
      ),
      new mapkit.CoordinateSpan(
        maxLat - minLat + latPadding * 2,
        maxLng - minLng + lngPadding * 2
      )
    ),
    true
  );
}

const Map = ({ token }: MapProps) => {
  useFeatureFlagsExposure();

  const mapRef = useRef<mapkit.Map | null>(null);
  const [mapkitReady, setMapkitReady] = useState(false);

  const [userCoordinates, setUserCoordinates] = useState<Coordinate>();
  const [rejectionVersion, setRejectionVersion] = useState(0);
  const rejectMinUntilRef = useRef(0);

  const [randomPlace, setRandomPlace] = useState<mapkit.Place>();
  const [activeRecommendation, setActiveRecommendation] =
    useState<RecommendationResult | null>(null);
  const [nextHydratedPlace, setNextHydratedPlace] = useState<mapkit.Place | null>(null);
  const [status, setStatus] = useState(STATUS.INIT);
  const [routePoints, setRoutePoints] = useState<Coordinate[][]>([]);
  const [routeInfo, setRouteInfo] = useState<{
    distanceMeters: number;
    durationSeconds: number;
  } | null>(null);
  const geocoder = useRef<mapkit.Geocoder | null>(null);
  const isManualLookup = useRef(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const mapPickerRef = useRef<HTMLDivElement>(null);

  const [screen, setScreen] = useState<Screen>("loading");
  const loadingStartedAt = useRef<number>(Date.now());
  const [pickNumber, setPickNumber] = useState(0);
  const pickNumberRef = useRef(0);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionLine, setRejectionLine] = useState("");

  const handleMapLoad = useCallback(() => {
    setMapkitReady(true);
    setStatus((prev) =>
      prev === STATUS.INIT ? STATUS.GETTING_YOUR_LOCATION : prev
    );
  }, []);

  const handleUserLocationChange = useCallback(
    (event: UserLocationChangeEvent) => {
      setUserCoordinates(event.coordinate);
      setStatus((prev) => {
        if (
          prev === STATUS.GETTING_YOUR_LOCATION ||
          prev === STATUS.INIT
        ) {
          return STATUS.LOCATION_FOUND;
        }
        return prev;
      });
    },
    []
  );

  const handleUserLocationError = useCallback(
    (event?: UserLocationErrorEvent) => {
      setStatus((prev) => {
        if (
          prev === STATUS.GETTING_YOUR_LOCATION ||
          prev === STATUS.INIT
        ) {
          return STATUS.LOCATION_NOT_FOUND;
        }
        return prev;
      });
      if (event) {
        console.warn(`Location error ${event.code}: ${event.message}`);
      }
    },
    []
  );

  useEffect(() => {
    if (!mapkitReady || status !== STATUS.GETTING_YOUR_LOCATION) return;
    if (isManualLookup.current) return;

    let resolved = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolved = true;
        if (isManualLookup.current) return;
        track("geolocation_granted");
        setUserCoordinates({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setStatus(STATUS.LOCATION_FOUND);
      },
      (err) => {
        resolved = true;
        if (err.code === err.PERMISSION_DENIED) {
          track("geolocation_denied", { code: err.code });
        } else {
          track("geolocation_error", { code: err.code, message: err.message });
        }
      },
      { timeout: 1000, maximumAge: 1000 * 60 * 15 }
    );

    const timeoutId = setTimeout(() => {
      if (!isManualLookup.current) {
        if (!resolved) track("geolocation_timeout");
        handleUserLocationError();
      }
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [mapkitReady, status, handleUserLocationError]);

  useEffect(() => {
    if (!mapkitReady) return;
    geocoder.current = new mapkit.Geocoder({ getsUserLocation: true });
  }, [mapkitReady]);

  const recommendationQuery = useRecommendationQuery({
    latitude: userCoordinates?.latitude,
    longitude: userCoordinates?.longitude,
    enabled:
      mapkitReady &&
      !!userCoordinates &&
      (status === STATUS.LOCATION_FOUND ||
        status === STATUS.LOOKING_FOR_RESULTS ||
        status === STATUS.RESULTS_FOUND),
    rejectionVersion,
  });

  useEffect(() => {
    if (!(mapkitReady && userCoordinates && status === STATUS.LOCATION_FOUND)) return;
    if (mapRef.current) {
      mapRef.current.setCenterAnimated(
        new mapkit.Coordinate(
          userCoordinates.latitude,
          userCoordinates.longitude
        ),
        true
      );
    }
    bumpSession("searches");
    setRandomPlace(undefined);
    setActiveRecommendation(null);
    setRoutePoints([]);
    setRouteInfo(null);
    setStatus(STATUS.LOOKING_FOR_RESULTS);
  }, [mapkitReady, userCoordinates, status]);

  useEffect(() => {
    if (status !== STATUS.LOOKING_FOR_RESULTS) return;
    if (recommendationQuery.isPending || recommendationQuery.isFetching) return;

    if (recommendationQuery.isError) {
      console.warn("Recommendation error:", recommendationQuery.error);
      setStatus(STATUS.NO_RESULTS_FOUND);
      return;
    }

    if (!recommendationQuery.data) {
      track("no_results_found");
      setStatus(STATUS.NO_RESULTS_FOUND);
      return;
    }

    track("results_found", { source: recommendationQuery.data.source });
    setStatus(STATUS.RESULTS_FOUND);
  }, [
    status,
    recommendationQuery.isPending,
    recommendationQuery.isFetching,
    recommendationQuery.isError,
    recommendationQuery.data,
  ]);

  // Hydrate the next recommendation (phone, urls) via MapKit's PlaceLookup
  // *before* we reveal it. The server's payload only carries name/address/coords
  // because the Apple Maps Server API doesn't expose contact info. The result
  // lives in `nextHydratedPlace`; the reveal effects below wait for it.
  useEffect(() => {
    if (!mapkitReady) return;
    const rec = recommendationQuery.data;
    if (!rec) {
      if (nextHydratedPlace !== null) setNextHydratedPlace(null);
      return;
    }
    if (nextHydratedPlace?.id === rec.appleMapsPlaceId) return;

    let cancelled = false;
    const fallback = toPlace(rec);
    const finish = (place: mapkit.Place) => {
      if (cancelled) return;
      setNextHydratedPlace(place);
    };
    // Bail out and use the slim payload if PlaceLookup hangs.
    const timeoutId = setTimeout(() => finish(fallback), 4000);

    const PlaceLookupCtor = (mapkit as unknown as {
      PlaceLookup?: new () => {
        getPlace: (id: string, cb: (e: Error | null, p: mapkit.Place | null) => void) => void;
      };
    }).PlaceLookup;
    if (!PlaceLookupCtor) {
      clearTimeout(timeoutId);
      finish(fallback);
      return;
    }
    const lookup = new PlaceLookupCtor();
    lookup.getPlace(rec.appleMapsPlaceId, (error, hydrated) => {
      clearTimeout(timeoutId);
      if (error || !hydrated) {
        if (error) console.warn("Place lookup failed, using slim payload:", error);
        finish(fallback);
        return;
      }
      finish(hydrated);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [mapkitReady, recommendationQuery.data, nextHydratedPlace]);

  // Initial reveal — first result for this location. Honors MIN_LOADING_MS so
  // the loading screen doesn't flash by, AND waits for hydration so phone/website
  // are populated when the card appears.
  useEffect(() => {
    if (status !== STATUS.RESULTS_FOUND) return;
    if (randomPlace) return;
    if (!nextHydratedPlace) return;

    const place = nextHydratedPlace;
    const rec = recommendationQuery.data ?? null;
    const reveal = () => {
      const nextPick = pickNumberRef.current + 1;
      pickNumberRef.current = nextPick;
      setRandomPlace(place);
      setActiveRecommendation(rec);
      setPickNumber(nextPick);
      setScreen("result");
      track("pick_shown", { pickNumber: nextPick, source: rec?.source });
      bumpSession("picksShown");
    };

    const elapsed = Date.now() - loadingStartedAt.current;
    const remaining = MIN_LOADING_MS - elapsed;
    if (remaining <= 0) {
      reveal();
      return;
    }
    const timeoutId = setTimeout(reveal, remaining);
    return () => clearTimeout(timeoutId);
  }, [status, nextHydratedPlace, randomPlace]);

  // Reject reveal — waits for both the refetch AND the hydration of the new
  // place, holds the overlay at least REJECT_OVERLAY_MS, then swaps.
  useEffect(() => {
    if (!rejecting) return;
    if (recommendationQuery.isFetching) return;

    const errored = recommendationQuery.isError;
    const noResult = !recommendationQuery.isError && !recommendationQuery.data;
    const hydratedForCurrent =
      !!recommendationQuery.data &&
      nextHydratedPlace?.id === recommendationQuery.data.appleMapsPlaceId;

    if (!errored && !noResult && !hydratedForCurrent) return;

    const remaining = Math.max(0, rejectMinUntilRef.current - Date.now());
    const finish = () => {
      setRejecting(false);
      if (errored || noResult || !hydratedForCurrent) {
        setStatus(STATUS.NO_RESULTS_FOUND);
        return;
      }
      const nextPick = pickNumberRef.current + 1;
      pickNumberRef.current = nextPick;
      const rec = recommendationQuery.data ?? null;
      setRandomPlace(nextHydratedPlace);
      setActiveRecommendation(rec);
      setPickNumber(nextPick);
      track("pick_shown", { pickNumber: nextPick, source: rec?.source });
      bumpSession("picksShown");
    };
    if (remaining === 0) {
      finish();
      return;
    }
    const timeoutId = setTimeout(finish, remaining);
    return () => clearTimeout(timeoutId);
  }, [
    rejecting,
    recommendationQuery.isFetching,
    recommendationQuery.data,
    recommendationQuery.isError,
    nextHydratedPlace,
  ]);

  useEffect(() => {
    if (!mapkitReady || !userCoordinates || !randomPlace) return;

    setRoutePoints([]);
    setRouteInfo(null);

    const origin = new mapkit.Coordinate(
      userCoordinates.latitude,
      userCoordinates.longitude
    );

    const destination = new mapkit.Coordinate(
      randomPlace.coordinate.latitude,
      randomPlace.coordinate.longitude
    );

    new mapkit.Directions().route(
      { origin, destination },
      (error, data) => {
        if (error || !data.routes.length) return;

        const primary = data.routes[0];
        const points = data.routes.map((route) =>
          route.polyline.points.map((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
          }))
        );
        setRoutePoints(points);

        if (
          typeof primary.distance === "number" &&
          typeof primary.expectedTravelTime === "number"
        ) {
          setRouteInfo({
            distanceMeters: primary.distance,
            durationSeconds: primary.expectedTravelTime,
          });
        }

        if (mapRef.current) {
          const allPoints = data.routes.flatMap((r) =>
            r.polyline.points.map((p) => ({
              latitude: p.latitude,
              longitude: p.longitude,
            }))
          );
          allPoints.push(userCoordinates);
          fitMapToPoints(mapRef.current, allPoints);
        }
      }
    );
  }, [randomPlace]);

  useEffect(() => {
    if (!showMapPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        mapPickerRef.current &&
        !mapPickerRef.current.contains(e.target as Node)
      ) {
        setShowMapPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMapPicker]);

  useEffect(() => {
    if (
      status === STATUS.INIT ||
      status === STATUS.GETTING_YOUR_LOCATION ||
      status === STATUS.LOOKING_FOR_RESULTS
    ) {
      setScreen((prev) => {
        if (prev === "result") return prev;
        if (prev !== "loading") loadingStartedAt.current = Date.now();
        return "loading";
      });
    } else if (
      status === STATUS.LOCATION_NOT_FOUND ||
      status === STATUS.NO_RESULTS_FOUND
    ) {
      setScreen("notfound");
    }
  }, [status]);

  const getMapServices = () => {
    if (!userCoordinates || !randomPlace) return [];
    const dLat = randomPlace.coordinate.latitude;
    const dLng = randomPlace.coordinate.longitude;
    const oLat = userCoordinates.latitude;
    const oLng = userCoordinates.longitude;
    return [
      {
        name: "Apple Maps",
        url: `https://maps.apple.com/?saddr=${oLat},${oLng}&daddr=${dLat},${dLng}&dirflg=d`,
      },
      {
        name: "Google Maps",
        url: `https://www.google.com/maps/dir/?api=1&origin=${oLat},${oLng}&destination=${dLat},${dLng}&travelmode=driving`,
      },
      {
        name: "Waze",
        url: `https://waze.com/ul?ll=${dLat},${dLng}&navigate=yes`,
      },
    ];
  };

  const geocoderLookup = (query: string) => {
    if (!geocoder.current) return;
    isManualLookup.current = true;
    setStatus(STATUS.GETTING_YOUR_LOCATION);
    setRandomPlace(undefined);
    setRoutePoints([]);
    setRouteInfo(null);
    track("manual_location_lookup");
    geocoder.current.lookup(query, (error, data) => {
      isManualLookup.current = false;
      if (error || !data?.results?.length) {
        track("manual_location_lookup_failed");
        setStatus(STATUS.LOCATION_NOT_FOUND);
        return;
      }
      const coord = data.results[0].coordinate;
      setUserCoordinates({
        latitude: coord.latitude,
        longitude: coord.longitude,
      });
      setStatus(STATUS.LOCATION_FOUND);
    });
  };

  const handleReject = () => {
    if (!randomPlace) return;
    const wasTopPick = activeRecommendation?.source === "top_pick";
    track("pick_rejected", { pickNumber, source: activeRecommendation?.source });
    bumpSession("picksRejected");
    recordRejection(randomPlace.id);
    const lines = wasTopPick ? TOP_PICK_REJECTIONS : REJECTIONS;
    setRejectionLine(lines[Math.floor(Math.random() * lines.length)]);
    rejectMinUntilRef.current = Date.now() + REJECT_OVERLAY_MS;
    setRejecting(true);
    setRejectionVersion((v) => v + 1);
  };

  const handleSoftSkip = () => {
    if (!randomPlace) return;
    track("pick_skipped", { pickNumber, source: activeRecommendation?.source });
    bumpSession("picksSkipped");
    recordSoftSkip(randomPlace.id);
    setRejectionLine(
      SOFT_SKIP_LINES[Math.floor(Math.random() * SOFT_SKIP_LINES.length)]
    );
    rejectMinUntilRef.current = Date.now() + SKIP_OVERLAY_MS;
    setRejecting(true);
    setRejectionVersion((v) => v + 1);
  };

  const handleWrongLocation = () => {
    track("wrong_location_clicked");
    setStatus(STATUS.LOCATION_NOT_FOUND);
  };

  const needsHiddenMap = screen === "loading" || screen === "notfound";
  const isTopPickResult =
    screen === "result" && activeRecommendation?.source === "top_pick";

  return (
    <div className={`app-root${isTopPickResult ? " app-root--toppick" : ""}`}>
      {screen !== "share" && <Header />}

      {needsHiddenMap && (
        <div style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 }}>
          <MapKitMap
            ref={mapRef}
            token={token}
            showsUserLocation
            onLoad={handleMapLoad}
            onUserLocationChange={handleUserLocationChange}
            onUserLocationError={handleUserLocationError}
          />
        </div>
      )}

      {screen === "loading" && <LoadingScreen />}

      {screen === "notfound" && (
        <NotFoundScreen
          onRetry={geocoderLookup}
          onRelocate={() => {
            isManualLookup.current = false;
            setStatus(STATUS.GETTING_YOUR_LOCATION);
          }}
          userCoordinates={userCoordinates}
        />
      )}

      {screen === "result" && randomPlace && (
        <ResultScreen
          place={randomPlace}
          recommendation={activeRecommendation}
          pickNumber={pickNumber}
          rejecting={rejecting}
          rejectionLine={rejectionLine}
          showMapPicker={showMapPicker}
          mapServices={getMapServices()}
          onToggleMapPicker={() => setShowMapPicker((prev) => !prev)}
          onCloseMapPicker={() => setShowMapPicker(false)}
          onReject={handleReject}
          onSkip={handleSoftSkip}
          onWrongLocation={handleWrongLocation}
          onShare={() => setScreen("share")}
          mapPickerRef={mapPickerRef}
          mapRef={mapRef}
          token={token}
          userCoordinates={userCoordinates}
          routePoints={routePoints}
          routeInfo={routeInfo}
          onMapLoad={handleMapLoad}
          onUserLocationChange={handleUserLocationChange}
          onUserLocationError={handleUserLocationError}
        />
      )}

      {screen === "share" && randomPlace && (
        <ShareScreen
          place={randomPlace}
          token={token}
          userCoordinates={userCoordinates}
          routePoints={routePoints}
          onClose={() => setScreen("result")}
        />
      )}
    </div>
  );
};

export default Map;
