import { useState, useRef, useEffect, useCallback } from "react";
import {
  Map as MapKitMap,
  Marker,
  Polyline,
} from "mapkit-react";
import type {
  Coordinate,
  UserLocationChangeEvent,
  UserLocationErrorEvent,
} from "mapkit-react";

import { STATUS } from "../types";
import { Overlay } from "./Overlay";
import { createUniqueRandomGenerator, getPlaceKey } from "../shared/utils";

interface MapProps {
  token: string;
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
  const title = "Where Should I Go To Eat?";

  const mapRef = useRef<mapkit.Map | null>(null);
  const [mapkitReady, setMapkitReady] = useState(false);

  const [userCoordinates, setUserCoordinates] = useState<Coordinate>();
  const randomResultGenerator =
    useRef<Generator<mapkit.Place, undefined, mapkit.Place>>();
  const seenResults = useRef(new Set<string>());

  const [randomPlace, setRandomPlace] = useState<mapkit.Place>();
  const [status, setStatus] = useState(STATUS.INIT);
  const [routePoints, setRoutePoints] = useState<Coordinate[][]>([]);
  const [locationQuery, setLocationQuery] = useState("");
  const geocoder = useRef<mapkit.Geocoder>();
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const isManualLookup = useRef(false);

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

  // Browser geolocation fallback + timeout (skip during manual geocoding)
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

  // Initialize geocoder when mapkit is ready
  useEffect(() => {
    if (!mapkitReady) return;
    geocoder.current = new mapkit.Geocoder({ getsUserLocation: true });
  }, [mapkitReady]);

  // Center map and search when location is found
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

  // Pick a random place when results are found
  useEffect(() => {
    if (status !== STATUS.RESULTS_FOUND) return;
    if (!randomResultGenerator.current) return;

    const rando = randomResultGenerator.current.next().value;
    if (!rando) return;
    setRandomPlace(rando);
  }, [status]);

  // Get directions when a random place is selected
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

  const geocoderLookup = () => {
    if (!geocoder.current) return;
    isManualLookup.current = true;
    setStatus(STATUS.GETTING_YOUR_LOCATION);
    setRandomPlace(undefined);
    setRoutePoints([]);
    geocoder.current.lookup(locationQuery, (error, data) => {
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

    // @ts-expect-error PointOfInterestFilter.including not typed
    const filters = mapkit.PointOfInterestFilter.including([
      // @ts-expect-error PointOfInterestCategory not typed
      mapkit.PointOfInterestCategory.Bakery,
      // @ts-expect-error PointOfInterestCategory not typed
      mapkit.PointOfInterestCategory.Cafe,
      // @ts-expect-error PointOfInterestCategory not typed
      mapkit.PointOfInterestCategory.Restaurant,
    ]);

    const pointOfInterestSearch = new mapkit.Search({
      region: searchRegion,
      getsUserLocation: true,
      language: "en-US",
      // @ts-ignore pointOfInterestFilter not typed
      pointOfInterestFilter: filters,
    });

    pointOfInterestSearch.search("Food", (error, data) => {
      if (error) {
        console.warn("Search error:", error);
        setStatus(STATUS.NO_RESULTS_FOUND);
        setIsOverlayVisible(true);
        return;
      }

      if (!data.places.length) {
        setStatus(STATUS.NO_RESULTS_FOUND);
        setIsOverlayVisible(true);
        return;
      }

      const filteredResults = data.places.filter(
        (place) => !seenResults.current.has(getPlaceKey(place))
      );
      if (!filteredResults.length) {
        setStatus(STATUS.NO_RESULTS_FOUND);
        setIsOverlayVisible(true);
        return;
      }

      setStatus(STATUS.RESULTS_FOUND);
      setIsOverlayVisible(false);
      randomResultGenerator.current = createUniqueRandomGenerator(
        filteredResults,
        seenResults.current
      );
    });
  };

  const renderRandomPlaceDetails = () => {
    if (!randomPlace) return null;

    const {
      name,
      // @ts-ignore
      _wpURL,
      // @ts-ignore
      telephone,
      formattedAddress,
      // @ts-ignore
      urls,
    } = randomPlace;

    return (
      <div className="sidebarContainer">
        <div className="place_details">
          <div>
            <h1 className="locationInfoHeader">Why Don&apos;t you Eat At</h1>
            {_wpURL ? (
              <a className="placeTitle" href={_wpURL}>
                {name}
              </a>
            ) : (
              <h2>{name}</h2>
            )}
          </div>
          <div className="locationInfoSection">
            <h3>Address</h3>
            <a href={`https://maps.google.com/?q=${formattedAddress}`}>
              {formattedAddress}
            </a>
          </div>
          <div className="locationInfoSection">
            <h3>Phone</h3>
            <p className="locationInfo_section_paragraph">{telephone}</p>
          </div>
          {(urls as string[])?.length > 0 ? (
            <div className="locationInfoSection">
              <h3>Website</h3>
              {(urls as string[]).map((url) => (
                <a key={url} href={url}>
                  {url}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <div className="button_bar">
          <button
            onClick={() => {
              if (!randomResultGenerator.current) return;
              const newPlace = randomResultGenerator.current.next();
              newPlace.done
                ? searchForPlacesToEat()
                : setRandomPlace(newPlace.value);
            }}
          >
            No! That Place Looks Awful
          </button>
          <button
            className="button_secondary"
            onClick={() => {
              setStatus(STATUS.LOCATION_NOT_FOUND);
              setIsOverlayVisible(true);
            }}
          >
            My Location is Wrong
          </button>
        </div>
      </div>
    );
  };

  const renderLocationOverlayChildren = () => {
    return (
      <>
        <input
          placeholder="Your Location"
          type="search"
          onChange={(e) => setLocationQuery(e.target.value)}
        />
        <div>
          <button
            className={locationQuery ? "" : "button_disabled"}
            disabled={status === STATUS.GETTING_YOUR_LOCATION || !locationQuery}
            onClick={geocoderLookup}
          >
            Search
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="container">
      <Overlay
        visible={isOverlayVisible}
        title={title}
        status={status}
        children={
          status === STATUS.LOCATION_NOT_FOUND ||
          status === STATUS.NO_RESULTS_FOUND
            ? renderLocationOverlayChildren()
            : undefined
        }
      />
      <div className="mapContainer">
        <MapKitMap
          ref={mapRef}
          token={token}
          showsUserLocation
          onLoad={handleMapLoad}
          onUserLocationChange={handleUserLocationChange}
          onUserLocationError={handleUserLocationError}
        >
          {userCoordinates && randomPlace && (
            <Marker
              latitude={userCoordinates.latitude}
              longitude={userCoordinates.longitude}
              color="#f96345"
              glyphText="🏠"
            />
          )}
          {randomPlace && (
            <Marker
              latitude={randomPlace.coordinate.latitude}
              longitude={randomPlace.coordinate.longitude}
              color="#5688d9"
              title={randomPlace.name}
              subtitle={randomPlace.formattedAddress}
            />
          )}
          {routePoints.map((points, i) => (
            <Polyline
              key={`route-${i}`}
              points={points}
              lineWidth={5}
              strokeColor="#139cc2"
            />
          ))}
        </MapKitMap>
      </div>
      {renderRandomPlaceDetails()}
    </div>
  );
};

export default Map;
