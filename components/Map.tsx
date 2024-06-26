import { useState, useRef, useEffect } from "react";
import { useMap, Map as MapKitMap } from "react-mapkit";

import { STATUS } from "../types";
import { Overlay } from "./Overlay";
import { createUniqueRandomGenerator, getPlaceKey } from '../shared/utils'

const Map = () => {
  let title = "Where Should I Go To Eat?";
  const { map, mapProps, setCenter, mapkit } = useMap({
    showsUserLocation: true,
  });
  const [userCoordinates, setUserCoordinates] = useState<mapkit.Coordinate>();
  const randomResultGenerator =
    useRef<Generator<mapkit.Place, undefined, mapkit.Place>>();
  const seenResults = useRef(new Set<string>());

  const [randomPlace, setRandomPlace] = useState<mapkit.Place>();
  const [status, setStatus] = useState(STATUS.INIT);
  const [placeAnnotation, setPlaceAnnotation] =
    useState<mapkit.MarkerAnnotation>();
  const [path, setPath] = useState<mapkit.PolylineOverlay[]>();
  const [locationQuery, setLocationQuery] = useState("");
  const geocoder = useRef<mapkit.Geocoder>();
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);

  const handleUserLocationChange = (event: {
    coordinate: mapkit.Coordinate;
    timestamp: Date;
  }) => {
    const { coordinate } = event;
    setStatus(STATUS.LOCATION_FOUND);
    setUserCoordinates(coordinate);
  };

  const handleUserLocationError = (error?: {
    code: number;
    message: string;
  }) => {
    setStatus(STATUS.LOCATION_NOT_FOUND);
    error && console.warn(`Error ${error.code}, ${error.message}`);
  };

  //Add location listener to the map
  useEffect(() => {
    if (!mapkit) {
        return;
    }
    // wait for the map to initialize and the event listeners to be empty
    if (map && status === STATUS.INIT) {
      setStatus(STATUS.GETTING_YOUR_LOCATION);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userCoords = new mapkit.Coordinate(
            pos.coords.latitude,
            pos.coords.longitude
          );
          setStatus(STATUS.LOCATION_FOUND);
          setUserCoordinates(userCoords);
        },
        (err) => {
          // TODO
          // Bugsnag._notify(err);
        },
        {
          timeout: 1000, // 1 sec,
          maximumAge: 1000 * 60 * 15, // 15 min
        }
      );

      map.addEventListener("user-location-change", handleUserLocationChange);
      map.addEventListener("user-location-error", handleUserLocationError);
      setTimeout(() => {
        handleUserLocationError();
      }, 10000);
    }

    return () => {
      map?.removeEventListener(
        "user-location-change",
        handleUserLocationChange
      );
      map?.removeEventListener("user-location-error", handleUserLocationError);
    };
  }, [map, status]);

  useEffect(() => {
    if (mapkit && userCoordinates && status === STATUS.LOCATION_FOUND) {
      setCenter([userCoordinates.latitude, userCoordinates.longitude]);
      searchForPlacesToEat();
    }
  }, [mapkit, userCoordinates, status]);

  //wait for mapkit to be initialized and create a new geocoder
  useEffect(() => {
    if (!mapkit) {
      return;
    }
    geocoder.current = new mapkit.Geocoder({
      getsUserLocation: true,
    });
  }, [mapkit]);

  useEffect(() => {
    if (status != STATUS.RESULTS_FOUND) {
      return;
    }

    if (!mapkit || !userCoordinates || !map || !randomResultGenerator.current) {
        return
    }

    // Place the users location on the map via a MarkerAnnotation
    let userAnnotation = new mapkit.MarkerAnnotation(userCoordinates);
    userAnnotation.color = "#f96345";
    userAnnotation.glyphText = "🏠";
    map.addAnnotation(userAnnotation);

    //pick a random place from the results
    const rando = randomResultGenerator.current.next().value;
    if (!rando) {
      return;
    }
    setRandomPlace(rando);
  }, [status]);

  useEffect(() => {
    if (!map || !mapkit || !userCoordinates) {
        return;
    }
    if (randomPlace) {
      //Clear current paths and annotations
      if (placeAnnotation) {
        map.removeAnnotation(placeAnnotation);
      }
      if (path) {
        //@ts-expect-error no types for this yet
        map.removeItems(path);
      }

      let randomPlaceAnnotation = new mapkit.MarkerAnnotation(
        randomPlace.coordinate
      );
      randomPlaceAnnotation.color = "#5688d9";
      randomPlaceAnnotation.title = randomPlace.name;
      randomPlaceAnnotation.subtitle = randomPlace.formattedAddress;

      // add the annotation to the map
      setPlaceAnnotation(randomPlaceAnnotation);
      map.addAnnotation(randomPlaceAnnotation);

      //Create a route for the place
      let route = new mapkit.Directions().route(
        {
          origin: userCoordinates,
          destination: randomPlace,
        },
        (error, data) => {
          let polylines = data.routes.map((route) => {
            return new mapkit.PolylineOverlay(route.polyline.points, {
              style: new mapkit.Style({
                lineWidth: 5,
                strokeColor: "#139cc2",
              }),
            });
          });

          setPath(polylines);

          map.showItems(polylines, {
            animate: true,
            padding: new mapkit.Padding({
              top: 200,
              right: 56,
              bottom: 100,
              left: 56,
            }),
          });
        }
      );
    }
  }, [randomPlace]);

  const geocoderLookup = () => {
    if (!map || !geocoder.current) {
        return;
    }
    setStatus(STATUS.GETTING_YOUR_LOCATION);
    //remove event listeners as location is being handled by the geocoder.
    map.removeEventListener("user-location-change", handleUserLocationChange);
    map.removeEventListener("user-location-error", handleUserLocationError);
    geocoder.current.lookup(locationQuery, (error, data) => {
      if (data.results.length > 0) {
        setStatus(STATUS.LOCATION_FOUND);
        setUserCoordinates(data.results[0].coordinate);
      } else {
        setStatus(STATUS.LOCATION_NOT_FOUND);
      }
    });
  };

  const searchForPlacesToEat = (query?: string) => {
    if (!mapkit || !userCoordinates) {
        return;
    }
    setStatus(STATUS.LOOKING_FOR_RESULTS);
    //Create a new point of interest filter
    //@ts-expect-error not typed
    let filters = new mapkit.PointOfInterestFilter.including([
      //@ts-expect-error not typed
      mapkit.PointOfInterestCategory.Bakery,
      //@ts-expect-error not typed
      mapkit.PointOfInterestCategory.Cafe,
      //@ts-expect-error not typed
      mapkit.PointOfInterestCategory.Restaurant,
    ]);

    let span = new mapkit.CoordinateSpan(1, 1);
    let searchRegion = new mapkit.CoordinateRegion(userCoordinates, span);

    let pointOfInterestSearch = new mapkit.Search({
      region: searchRegion,
      getsUserLocation: true,
      language: "en-US",
      //@ts-ignore
      pointOfInterestFilter: filters,
    });

    pointOfInterestSearch.search("Food", (error, data) => {
      if (error) {
        // TODO handle error
        console.warn("error while searching");
        return;
      }

      if (!data.places.length) {
        setStatus(STATUS.NO_RESULTS_FOUND);
        return;
      }

      // Filter out the ones already seen
      const filteredResults = data.places.filter(
        (place) => !seenResults.current.has(getPlaceKey(place))
      );
      if (!filteredResults.length) {
        setStatus(STATUS.NO_RESULTS_FOUND);
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
    if (randomPlace) {
      const {
        name,
        //@ts-ignore
        _wpURL,
        //@ts-ignore
        telephone,
        formattedAddress,
        //@ts-ignore
        urls,
      } = randomPlace;
      return (
        <div className="sidebarContainer">
          <div className="place_details">
            <div>
              <h1 className="locationInfoHeader">Why Don't you Eat At</h1>
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
                <a href={`https://maps.google.com/?q=${formattedAddress}`}>
                  {formattedAddress}
                </a>
              </a>
            </div>
            <div className="locationInfoSection">
              <h3>Phone</h3>
              <p className="locationInfo_section_paragraph">{telephone}</p>
            </div>
            {(urls as string[]).length > 0 ? (
              <div className="locationInfoSection">
                <h3>Website</h3>
                {(urls as string[]).map((url) => (
                  <a href={url}>{url}</a>
                ))}
              </div>
            ) : null}
          </div>
          <div className="button_bar">
            <button
              onClick={() => {
                if (!randomResultGenerator.current) {
                    return;
                }
                let newPlace = randomResultGenerator.current.next();
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
    } else {
      return null;
    }
  };

  const renderLocationOverlayChildren = () => {
    return (
      <>
        <input
          placeholder="Your Location"
          type="search"
          onChange={(e) => {
            setLocationQuery(e.target.value);
          }}
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
          status === STATUS.LOCATION_NOT_FOUND
            ? renderLocationOverlayChildren()
            : undefined
        }
      />
      <div className="mapContainer">
        <MapKitMap {...mapProps} />
      </div>
      {renderRandomPlaceDetails()}
    </div>
  );
};

export default Map;
