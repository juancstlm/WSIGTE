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
import { createUniqueRandomGenerator, getPlaceKey } from "../shared/utils";
import { REJECTIONS } from "../shared/constants";
import { Header } from "./Header";
import { LoadingScreen } from "./LoadingScreen";
import { NotFoundScreen } from "./NotFoundScreen";
import { ResultScreen } from "./ResultScreen";
import { ShareScreen } from "./ShareScreen";

interface MapProps {
  token: string;
}

type Screen = "loading" | "notfound" | "result" | "share";

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
  const mapRef = useRef<mapkit.Map | null>(null);
  const [mapkitReady, setMapkitReady] = useState(false);

  const [userCoordinates, setUserCoordinates] = useState<Coordinate>();
  const randomResultGenerator =
    useRef<Generator<mapkit.Place, undefined, mapkit.Place> | null>(null);
  const seenResults = useRef(new Set<string>());

  const [randomPlace, setRandomPlace] = useState<mapkit.Place>();
  const [status, setStatus] = useState(STATUS.INIT);
  const [routePoints, setRoutePoints] = useState<Coordinate[][]>([]);
  const geocoder = useRef<mapkit.Geocoder | null>(null);
  const isManualLookup = useRef(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const mapPickerRef = useRef<HTMLDivElement>(null);

  const [screen, setScreen] = useState<Screen>("loading");
  const [pickNumber, setPickNumber] = useState(0);
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

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (isManualLookup.current) return;
        setUserCoordinates({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setStatus(STATUS.LOCATION_FOUND);
      },
      () => {},
      { timeout: 1000, maximumAge: 1000 * 60 * 15 }
    );

    const timeoutId = setTimeout(() => {
      if (!isManualLookup.current) {
        handleUserLocationError();
      }
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [mapkitReady, status, handleUserLocationError]);

  useEffect(() => {
    if (!mapkitReady) return;
    geocoder.current = new mapkit.Geocoder({ getsUserLocation: true });
  }, [mapkitReady]);

  useEffect(() => {
    if (mapkitReady && userCoordinates && status === STATUS.LOCATION_FOUND) {
      if (mapRef.current) {
        mapRef.current.setCenterAnimated(
          new mapkit.Coordinate(
            userCoordinates.latitude,
            userCoordinates.longitude
          ),
          true
        );
      }
      searchForPlacesToEat();
    }
  }, [mapkitReady, userCoordinates, status]);

  useEffect(() => {
    if (status !== STATUS.RESULTS_FOUND) return;
    if (!randomResultGenerator.current) return;

    const rando = randomResultGenerator.current.next().value;
    if (!rando) return;
    setRandomPlace(rando);
    setPickNumber((n) => n + 1);
    setScreen("result");
  }, [status]);

  useEffect(() => {
    if (!mapkitReady || !userCoordinates || !randomPlace) return;

    setRoutePoints([]);

    const origin = new mapkit.Coordinate(
      userCoordinates.latitude,
      userCoordinates.longitude
    );

    new mapkit.Directions().route(
      { origin, destination: randomPlace },
      (error, data) => {
        if (error || !data.routes.length) return;

        const points = data.routes.map((route) =>
          route.polyline.points.map((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
          }))
        );
        setRoutePoints(points);

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
      setScreen((prev) => prev === "result" ? prev : "loading");
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
    geocoder.current.lookup(query, (error, data) => {
      isManualLookup.current = false;
      if (error || !data?.results?.length) {
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

  const searchForPlacesToEat = () => {
    if (!mapkitReady || !userCoordinates) return;

    setStatus(STATUS.LOOKING_FOR_RESULTS);
    setRandomPlace(undefined);
    setRoutePoints([]);

    const coord = new mapkit.Coordinate(
      userCoordinates.latitude,
      userCoordinates.longitude
    );
    const span = new mapkit.CoordinateSpan(1, 1);
    const searchRegion = new mapkit.CoordinateRegion(coord, span);

    const filters = mapkit.PointOfInterestFilter.including([
      mapkit.PointOfInterestCategory.Bakery,
      mapkit.PointOfInterestCategory.Cafe,
      mapkit.PointOfInterestCategory.Restaurant,
    ]);

    const pointOfInterestSearch = new mapkit.Search({
      region: searchRegion,
      getsUserLocation: true,
      language: "en-US",
      pointOfInterestFilter: filters,
    });

    pointOfInterestSearch.search("Food", (error, data) => {
      if (error) {
        console.warn("Search error:", error);
        setStatus(STATUS.NO_RESULTS_FOUND);
        return;
      }

      if (!data.places.length) {
        setStatus(STATUS.NO_RESULTS_FOUND);
        return;
      }

      const filteredResults = data.places.filter(
        (place) => !seenResults.current.has(getPlaceKey(place))
      );
      if (!filteredResults.length) {
        setStatus(STATUS.NO_RESULTS_FOUND);
        return;
      }

      setStatus(STATUS.RESULTS_FOUND);
      randomResultGenerator.current = createUniqueRandomGenerator(
        filteredResults,
        seenResults.current
      );
    });
  };

  const handleReject = () => {
    setRejectionLine(
      REJECTIONS[Math.floor(Math.random() * REJECTIONS.length)]
    );
    setRejecting(true);
    setTimeout(() => {
      setRejecting(false);
      if (!randomResultGenerator.current) return;
      const newPlace = randomResultGenerator.current.next();
      if (newPlace.done) {
        setStatus(STATUS.NO_RESULTS_FOUND);
      } else {
        setRandomPlace(newPlace.value);
        setPickNumber((n) => n + 1);
      }
    }, 950);
  };

  const handleWrongLocation = () => {
    setStatus(STATUS.LOCATION_NOT_FOUND);
  };

  const needsHiddenMap = screen === "loading" || screen === "notfound";

  return (
    <div className="app-root">
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
        <NotFoundScreen onRetry={geocoderLookup} />
      )}

      {screen === "result" && randomPlace && (
        <ResultScreen
          place={randomPlace}
          pickNumber={pickNumber}
          rejecting={rejecting}
          rejectionLine={rejectionLine}
          showMapPicker={showMapPicker}
          mapServices={getMapServices()}
          onToggleMapPicker={() => setShowMapPicker((prev) => !prev)}
          onCloseMapPicker={() => setShowMapPicker(false)}
          onReject={handleReject}
          onWrongLocation={handleWrongLocation}
          onShare={() => setScreen("share")}
          mapPickerRef={mapPickerRef}
          mapRef={mapRef}
          token={token}
          userCoordinates={userCoordinates}
          routePoints={routePoints}
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
