import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
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
import { useFeatureFlagsExposure } from "../shared/queries";
import { useRecommendationQueue } from "../shared/hooks/useRecommendationQueue";
import { bumpSession, track } from "../shared/utils";
import { clearRejections } from "../shared/utils/rejections";
import { recordSoftSkip, clearSoftSkips } from "../shared/utils/softSkips";
import { SOFT_SKIP_LINES } from "../shared/constants";
import type { RecommendationResult } from "../shared/api";
import { Header } from "./Header";
import { LoadingScreen } from "./LoadingScreen";
import { NotFoundScreen } from "./NotFoundScreen";
import { NoResultsScreen } from "./NoResultsScreen";
import { ResultScreen } from "./ResultScreen";
import { ShareScreen } from "./ShareScreen";

interface MapProps {
  token: string;
}

type Screen = "loading" | "notfound" | "noresults" | "result" | "share";

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

  const [randomPlace, setRandomPlace] = useState<mapkit.Place>();
  const [activeRecommendation, setActiveRecommendation] =
    useState<RecommendationResult | null>(null);
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
  // false = browsing the swipe deck; true = the user accepted a pick and the
  // map + full results have taken over.
  const [picked, setPicked] = useState(false);
  // The city the current picks are coming from (reverse-geocoded), shown in the
  // header. null = not resolved yet ("Locating…").
  const [cityLabel, setCityLabel] = useState<string | null>(null);
  // true = the user deliberately opened the location changer from the header,
  // so the NotFound search shows neutral "change location" copy (not "we lost
  // you"). false = a genuine GPS failure routed there.
  const [isChangingLocation, setIsChangingLocation] = useState(false);
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
      setIsChangingLocation(false);
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

  // Reverse-geocode the current coordinates into a city name for the header
  // indicator. Runs for both GPS and manual lookups since they both flow
  // through `userCoordinates`. Ignores stale callbacks if coords changed.
  useEffect(() => {
    if (!mapkitReady || !geocoder.current || !userCoordinates) return;
    const { latitude, longitude } = userCoordinates;
    let cancelled = false;
    geocoder.current.reverseLookup(
      new mapkit.Coordinate(latitude, longitude),
      (error, data) => {
        if (cancelled || error || !data?.results?.length) return;
        const place = data.results[0] as mapkit.Place & {
          locality?: string;
          administrativeAreaCode?: string;
          administrativeArea?: string;
          country?: string;
        };
        const city = place.locality;
        const state = place.administrativeAreaCode || place.administrativeArea;
        const label =
          city && state
            ? `${city}, ${state}`
            : city ||
              place.administrativeArea ||
              place.country ||
              place.formattedAddress?.split(",")[0] ||
              null;
        if (label) setCityLabel(label);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [mapkitReady, userCoordinates]);

  const queue = useRecommendationQueue({
    latitude: userCoordinates?.latitude,
    longitude: userCoordinates?.longitude,
    enabled:
      mapkitReady &&
      !!userCoordinates &&
      (status === STATUS.LOCATION_FOUND ||
        status === STATUS.LOOKING_FOR_RESULTS ||
        status === STATUS.RESULTS_FOUND),
  });
  const { head, peek } = queue;

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
    // New location — drop any buffered picks for the old coordinates and re-fill.
    queue.reset();
    setIsChangingLocation(false);
    setRandomPlace(undefined);
    setActiveRecommendation(null);
    setPicked(false);
    setRoutePoints([]);
    setRouteInfo(null);
    setStatus(STATUS.LOOKING_FOR_RESULTS);
  }, [mapkitReady, userCoordinates, status]);

  // Reveal / promote the displayed pick from the queue head. The buffer keeps
  // the next pick pre-fetched + pre-hydrated, so a skip/reject (which `consume`s
  // the head) promotes the next card instantly. Only the *first* reveal honors
  // MIN_LOADING_MS so the loading screen doesn't flash by.
  useEffect(() => {
    if (status !== STATUS.LOOKING_FOR_RESULTS && status !== STATUS.RESULTS_FOUND) return;
    if (!head) return;
    if (randomPlace && randomPlace.id === head.place.id) return;

    const reveal = () => {
      const nextPick = pickNumberRef.current + 1;
      pickNumberRef.current = nextPick;
      setRandomPlace(head.place);
      setActiveRecommendation(head.recommendation);
      setPickNumber(nextPick);
      setRejecting(false);
      setScreen("result");
      setStatus(STATUS.RESULTS_FOUND);
      track("pick_shown", {
        pickNumber: nextPick,
        source: head.recommendation.source,
      });
      bumpSession("picksShown");
    };

    if (randomPlace) {
      // Promoting the next card after a swipe/skip — already hydrated, instant.
      reveal();
      return;
    }
    // First card for this location — respect the minimum loading time.
    const remaining = MIN_LOADING_MS - (Date.now() - loadingStartedAt.current);
    if (remaining <= 0) {
      reveal();
      return;
    }
    const timeoutId = setTimeout(reveal, remaining);
    return () => clearTimeout(timeoutId);
  }, [status, head, randomPlace]);

  // Out of picks — the buffer drained and the server has nothing left nearby.
  useEffect(() => {
    if (status !== STATUS.LOOKING_FOR_RESULTS && status !== STATUS.RESULTS_FOUND) return;
    if (head) return;
    if (queue.filling) return;
    if (!queue.exhausted) return;
    track("no_results_found");
    setRejecting(false);
    setStatus(STATUS.NO_RESULTS_FOUND);
  }, [status, head, queue.filling, queue.exhausted]);

  // The route + map only exist once the user has picked, so don't spend a
  // Directions call per swiped card — compute it when a pick is locked in.
  useEffect(() => {
    if (!picked || !mapkitReady || !userCoordinates || !randomPlace) return;

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
  }, [picked, randomPlace]);

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
    } else if (status === STATUS.LOCATION_NOT_FOUND) {
      setScreen("notfound");
    } else if (status === STATUS.NO_RESULTS_FOUND) {
      setScreen("noresults");
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
    setIsChangingLocation(false);
    setStatus(STATUS.GETTING_YOUR_LOCATION);
    setRandomPlace(undefined);
    setPicked(false);
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

  // Drop the current pick and promote the next. The next card is already
  // buffered + hydrated, so it appears instantly; we only flash the
  // "finding next" face when the buffer has drained (no `peek` ready).
  const advance = (line: string) => {
    if (!queue.peek) {
      setRejectionLine(line);
      setRejecting(true);
    }
    queue.consume();
  };

  const handleSoftSkip = () => {
    if (!randomPlace) return;
    track("pick_skipped", { pickNumber, source: activeRecommendation?.source });
    bumpSession("picksSkipped");
    recordSoftSkip(randomPlace.id);
    advance(SOFT_SKIP_LINES[Math.floor(Math.random() * SOFT_SKIP_LINES.length)]);
  };

  // Accept the current card — lock it in and reveal the map + full results.
  const handlePick = () => {
    if (!randomPlace) return;
    track("pick_accepted", { pickNumber, source: activeRecommendation?.source });
    bumpSession("picksAccepted");
    setShowMapPicker(false);
    setPicked(true);
  };

  // "Pick again" from the results — go back to swiping the same buffer.
  const handleBack = () => {
    track("pick_again_clicked");
    setShowMapPicker(false);
    setRoutePoints([]);
    setRouteInfo(null);
    setPicked(false);
  };

  // Open the location changer (full-screen search) from the header indicator.
  const handleChangeLocation = () => {
    track("change_location_clicked");
    setIsChangingLocation(true);
    setStatus(STATUS.LOCATION_NOT_FOUND);
  };

  // "← Back to picks" from the changer — return to the current pick (still
  // buffered) without re-rolling. Only offered when a pick exists.
  const handleCancelChange = () => {
    track("change_location_cancelled");
    setIsChangingLocation(false);
    setStatus(STATUS.RESULTS_FOUND);
    // The reveal effect won't re-fire (head is already the shown pick), so route
    // back to the result screen explicitly.
    setScreen("result");
  };

  // "Start over" from the out-of-results screen: the dry spell is usually the
  // user's own rejections/skips piling into the excluded list, so wipe that
  // history and re-roll from the same coordinates.
  const handleReset = () => {
    if (!userCoordinates) return;
    track("noresults_reset");
    clearRejections();
    clearSoftSkips();
    queue.reset();
    setRandomPlace(undefined);
    setActiveRecommendation(null);
    setPicked(false);
    setRejecting(false);
    setRoutePoints([]);
    setRouteInfo(null);
    setStatus(STATUS.LOOKING_FOR_RESULTS);
  };

  const needsHiddenMap =
    screen === "loading" || screen === "notfound" || screen === "noresults";
  const isTopPickResult =
    screen === "result" && activeRecommendation?.source === "top_pick";

  return (
    <div className={`app-root${isTopPickResult ? " app-root--toppick" : ""}`}>
      {screen !== "share" && (
        <Header cityLabel={cityLabel} onChangeLocation={handleChangeLocation} />
      )}

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

      {screen !== "share" && (
        <div className="screen-stage">
          {/* The loading screen, the first pick, and the fallback screens
              crossfade through one stage so the hand-off from "HOLD STILL." to
              the first card defocuses out and rises in instead of hard-cutting. */}
          <AnimatePresence initial={false}>
            {screen === "loading" && (
              <motion.div
                key="loading"
                className="screen-frame"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <LoadingScreen />
              </motion.div>
            )}

            {screen === "notfound" && (
              <motion.div
                key="notfound"
                className="screen-frame"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <NotFoundScreen
                  onRetry={geocoderLookup}
                  onRelocate={() => {
                    setIsChangingLocation(false);
                    isManualLookup.current = false;
                    setStatus(STATUS.GETTING_YOUR_LOCATION);
                  }}
                  onBack={randomPlace ? handleCancelChange : undefined}
                  variant={isChangingLocation ? "change" : "lost"}
                  userCoordinates={userCoordinates}
                />
              </motion.div>
            )}

            {screen === "noresults" && (
              <motion.div
                key="noresults"
                className="screen-frame"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <NoResultsScreen
                  onSearch={geocoderLookup}
                  onReset={handleReset}
                  userCoordinates={userCoordinates}
                />
              </motion.div>
            )}

            {screen === "result" && randomPlace && (
              <motion.div
                key="result"
                className="screen-frame"
                initial={{ opacity: 0, y: 26, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <ResultScreen
                  place={randomPlace}
                  recommendation={activeRecommendation}
                  peek={
                    peek
                      ? {
                          name: peek.recommendation.name,
                          photoUrl: peek.recommendation.photoUrl,
                          isTopPick: peek.recommendation.source === "top_pick",
                        }
                      : null
                  }
                  pickNumber={pickNumber}
                  rejecting={rejecting}
                  rejectionLine={rejectionLine}
                  showMapPicker={showMapPicker}
                  mapServices={getMapServices()}
                  onToggleMapPicker={() => setShowMapPicker((prev) => !prev)}
                  onCloseMapPicker={() => setShowMapPicker(false)}
                  picked={picked}
                  onSkip={handleSoftSkip}
                  onPick={handlePick}
                  onBack={handleBack}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
