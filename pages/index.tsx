import Head from "next/head";
import { useEffect, useState, useRef } from "react";
import { Map, MapkitProvider, Marker, useMap } from "react-mapkit";
import { Overlay } from "../components/Overlay";
import * as React from "react";
// import { getYelpData } from '../services/api';
import Bugsnag from "@bugsnag/js";
import BugsnagPluginReact from "@bugsnag/plugin-react";
import useAddSense from "../shared/hooks/use-addsense";

Bugsnag.start({
  apiKey: "64e770e7c1fa67c74c6a5e2f2e93512e",
  plugins: [new BugsnagPluginReact()],
});

const ErrorBoundary = Bugsnag.getPlugin("react").createErrorBoundary(React);

export const STATUS = {
  INIT: "Initializing",
  GETTING_YOUR_LOCATION: "Getting your location",
  LOCATION_FOUND: "Location Found",
  LOOKING_FOR_RESULTS: "Looking for Places to Eat",
  RESULTS_FOUND: "Results Found",
  NO_RESULTS_FOUND: "Out of Luck Chief",
  LOCATION_NOT_FOUND: "We could not find you, try another address.",
};

type Coordinates = { 

}

interface EventBase<T> {
  type: string;
  target: T;
}

export default function Home() {
  const UseMapExample = () => {
    let title = "Where Should I Go To Eat?";
    const { map, mapProps, setCenter, mapkit, setRegion } = useMap({
      showsUserLocation: true,
    });
    const [userCoordinates, setUserCoordinates] = useState<mapkit.Coordinate>();
    const [results, setResults] = useState([]);
    const [randomResultGenerator, setRandomResultsGenerator] = useState();
    const [randomPlace, setRandomPlace] = useState();
    const [status, setStatus] = useState(STATUS.INIT);
    const [placeAnnotation, setPlaceAnnotation] = useState();
    const [path, setPath] = useState();
    const [locationQuery, setLocationQuery] = useState("");
    const geocoder = useRef<mapkit.Geocoder>();
    const [isOverlayVisible, setIsOverlayVisible] = useState(true);

    //addsense Script
    useAddSense();
    //Add location listener to the map
    useEffect(() => {
      // wait for the map to initialize and the event listeners to be empty
      if (map && status === STATUS.INIT) {
        setStatus(STATUS.GETTING_YOUR_LOCATION);
        map.addEventListener("user-location-change", handleUserLocationChange);
        map.addEventListener("user-location-error", handleUserLocationError);
        setTimeout(() => {
          handleUserLocationError()
        }, 10000)
      }
    }, [map, status]);


    useEffect(() => {
      if (mapkit && userCoordinates && status === STATUS.LOCATION_FOUND) {
        let span = new mapkit.CoordinateSpan(0.1, 0.1);
        // let region = new mapkit.CoordinateRegion(userCoordinates, span);
        // setRegion(region)
        setCenter([userCoordinates.latitude, userCoordinates.longitude]);
        searchForPlacesToEat();
      }
    }, [mapkit, userCoordinates, status]);

    //wait for mapkit to be initialized and create a new geocoder
    useEffect(() => {
      if (mapkit) {
        geocoder.current = new mapkit.Geocoder({
          getsUserLocation: true,
        });
      }
    }, [mapkit]);

    useEffect(() => {
      if (results?.length > 1) {
        // Place the users location on the map via a MarkerAnnotation
        let userAnnotation = new mapkit.MarkerAnnotation(userCoordinates);
        userAnnotation.color = "#f96345";
        userAnnotation.glyphText = "🏠";
        map.addAnnotation(userAnnotation);

        //pick a random place from the results
        setRandomPlace(randomResultGenerator.next().value);
      }
    }, [results]);

    useEffect(() => {
      if (randomPlace) {
        //Clear current paths and annotations
        if (placeAnnotation) {
          map.removeAnnotation(placeAnnotation);
        }
        if (path) {
          map.removeItems(path);
        }

        // //check if yelp has data
        // if(randomPlace._providerId === 'com.yelp'){
        //   console.log(randomPlace._providerItemId)
        //   getYelpData(randomPlace._providerItemId)
        // }
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

    function* createUniqueRandomGenerator(places) {
      const available = places;

      while (available.length !== 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        const value = available[randomIndex];

        available.splice(randomIndex, 1);
        yield value;
      }
    }

    const handleUserLocationChange = (event :{ coordinate: mapkit.Coordinate; timestamp: Date }) => {
      const { coordinate } = event;
      setStatus(STATUS.LOCATION_FOUND);
      setUserCoordinates(coordinate);
      console.log("User Location Changed", coordinate);
      map.removeEventListener("user-location-change", handleUserLocationChange);
      map.removeEventListener("user-location-error", handleUserLocationError);
    };

    const handleUserLocationError = (error?: { code: number; message: string }) => {
      setStatus(STATUS.LOCATION_NOT_FOUND);
      error && console.warn(`Error ${error.code}, ${error.message}`);
    };

    const geocoderLookup = () => {
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

    const renderLoadingScreen = () => {
      if (!randomPlace) {
        return <Overlay />;
      }
      return null;
    };

    // if (geocoder && status === STATUS.LOCATION_NOT_FOUND) {
    //   return (<div className='loadingScreenContainer'>
    //     <h1 className='loadingScreenTitle'>Where Should I Go To Eat</h1>
    //     {status === STATUS.INIT ? <p className='loadingScreenSubtitle'>Loading</p> : null}
    //     <p className='loadingScreenStatus'>{status}</p>
    //     <input placeholder='Your Location' type='search' onChange={(e) => {
    //       setLocationQuery(e.target.value)
    //     }}/>
    //     <div>
    //       <button disabled={status=== STATUS.GETTING_YOUR_LOCATION} onClick={geocoderLookup}>Search</button>
    //     </div>
    //   </div>)
    // } return null;

    const searchForPlacesToEat = () => {
      setStatus(STATUS.LOOKING_FOR_RESULTS);
      //Create a new point of interest filter
      let filters = new mapkit.PointOfInterestFilter.including([
        mapkit.PointOfInterestCategory.Bakery,
        mapkit.PointOfInterestCategory.Cafe,
        mapkit.PointOfInterestCategory.Restaurant,
      ]);

      // let pointOfInterestSearch = new mapkit.PointsOfInterestSearch({
      //   center: userCoordinates,
      //   pointOfInterestFilter: filters,
      //   radius: searchRadius,
      // })
      let span = new mapkit.CoordinateSpan(1, 1);
      let searchRegion = new mapkit.CoordinateRegion(userCoordinates, span);
      let pointOfInterestSearch = new mapkit.Search({
        region: searchRegion,
        getsUserLocation: true,
        language: "en-US",
        pointOfInterestFilter: filters,
      });

      pointOfInterestSearch.search("Food", (error, data) => {
        if (error) {
          // TODO handle error
          console.warn("error while searching ");
          return;
        }

        if (data.places.length === 0) {
          setStatus(STATUS.NO_RESULTS_FOUND);
          //no places found increase the radius
          // if(searchRadius < MAX_RADIUS){
          //   setRadius(searchRadius * 2)
          //   searchForPlacesToEat(searchRadius * 2)
          // } else {
          //   setStatus(STATUS.NO_RESULTS_FOUND)
          // }
        } else {
          setStatus(STATUS.RESULTS_FOUND);
          setIsOverlayVisible(false);
          setRandomResultsGenerator(createUniqueRandomGenerator(data.places));
          setResults(data.places);
        }
      });
    };

    const renderRandomPlaceDetails = () => {
      if (randomPlace) {
        const {
          name,
          coordinate,
          _wpURL,
          telephone,
          formattedAddress,
          fullThoroughfare,
          pointOfInterestCategory,
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
                {/*<p>{pointOfInterestCategory}</p>*/}
              </div>
              <div className="locationInfoSection">
                <h3>Address</h3>
                <a href={`https://maps.google.com/?q=${formattedAddress}`}>
                  <a href={`https://maps.google.com/?q=${formattedAddress}`}>
                    {formattedAddress}
                  </a>
                </a>
                {/*<a href={`geo:${coordinate.latitude},${coordinate.longitude}`} target="_blank" className='locationInfo_section_paragraph'>{formattedAddress}</a>*/}
              </div>
              <div className="locationInfoSection">
                <h3>Phone</h3>
                <p className="locationInfo_section_paragraph">{telephone}</p>
              </div>
              {urls.length > 0 ? (
                <div className="locationInfoSection">
                  <h3>Websites</h3>
                  {urls.map((url) => (
                    <a href={url}>{url}</a>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="button_bar">
              <button
                onClick={() => {
                  let newPlace = randomResultGenerator.next();
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
              disabled={
                status === STATUS.GETTING_YOUR_LOCATION || !locationQuery
              }
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
          <Map {...mapProps} />
        </div>
        {renderRandomPlaceDetails()}
        {/*<div className='addSense'>*/}
        {/*  <AdSense.Google*/}
        {/*  client="ca-pub-1977255269343770"*/}
        {/*  slot="7259870550"*/}
        {/*  style={{ width: 500, height: 200 }}*/}
        {/*  ayout='in-article'*/}
        {/*  format=""*/}
        {/*/></div>*/}
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <MapkitProvider
        tokenOrCallback={
          "https://8q2oxsizal.execute-api.us-east-1.amazonaws.com/dev/token"
        }
      >
        <UseMapExample />
      </MapkitProvider>
    </ErrorBoundary>
  );
}
