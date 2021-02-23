import Head from 'next/head'
import styles from '../styles/Home.module.css'
import { useEffect, useState } from 'react';
import { Map, MapkitProvider, Marker, useMap } from 'react-mapkit';

export default function Home() {

  const STATUS = {
    INIT: 'Initializing',
    GETTING_YOUR_LOCATION:'Getting your location',
    LOCATION_FOUND: 'Location Found',
    LOOKING_FOR_RESULTS: 'Looking for Places to Eat',
    RESULTS_FOUND: 'Results Found',
    NO_RESULTS_FOUND: 'Out of Luck Chief',
    LOCATION_NOT_FOUND: 'We could not find you try another address.'
  }

  const MAX_RADIUS = 60000;

  const UseMapExample = () => {
    const { map, mapProps, setCenter, mapkit, setRegion, setVisibleMapRect } = useMap({showsUserLocation: true,})
    const [userCoordinates, setUserCoordinates] = useState()
    const [results, setResults] = useState([])
    const [randomResultGenerator, setRandomResultsGenerator] = useState()
    const [randomPlace, setRandomPlace] = useState()
    const [status, setStatus] =  useState(STATUS.INIT)
    const [placeAnnotation, setPlaceAnnotation] = useState()
    const [path, setPath] = useState()
    const [radius, setRadius] = useState(3000);
    const [locationQuery, setLocationQuery] = useState('')
    const [geocoder, setGeocoder] = useState()

    //Add location listener to the map
    useEffect(()=>{
      // wait for the map to initialize and the event listeners to be empty
      if (map && status === STATUS.INIT) {
        map.addEventListener('user-location-change', handleUserLocationChange)
        map.addEventListener('user-location-error',handleUserLocationError)
      }
    }, [map])

    useEffect(()=>{
      if(mapkit && userCoordinates && status === STATUS.LOCATION_FOUND){
        let span = new mapkit.CoordinateSpan(.016, .016);
        let region = new mapkit.CoordinateRegion(userCoordinates, span);
        setRegion(region)
        setCenter([userCoordinates.latitude,
          userCoordinates.longitude])
        searchForPlacesToEat(radius)
      }

    }, [mapkit, userCoordinates])

    //wait for mapkit to be initialized and create a new geocoder
    useEffect(() => {
      if(mapkit){
        setGeocoder(new mapkit.Geocoder({
          getsUserLocation: true
        }))
      }
    }, [mapkit])

    useEffect(() => {
      if(results?.length > 1){
        // Place the users location on the map via a MarkerAnnotation
        let userAnnotation = new mapkit.MarkerAnnotation(userCoordinates);
        userAnnotation.color = "#f96345";
        userAnnotation.glyphText = "🏠";
        map.addAnnotation(userAnnotation);

        //pick a random place from the results
        setRandomPlace(randomResultGenerator.next().value)
      }
    }, [results]);

    useEffect(() => {
      if(randomPlace){
        //Clear current paths and annotations
        if(placeAnnotation){
          map.removeAnnotation(placeAnnotation)
        }
        if(path){
          map.removeItems(path)
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
            destination: randomPlace
          },
          (error, data) => {
            let polylines = data.routes.map(route => {
              return new mapkit.PolylineOverlay(route.polyline.points, {
                style: new mapkit.Style({
                  lineWidth: 5,
                  strokeColor: "#139cc2"
                })
              });
            });

            setPath(polylines)

            map.showItems(polylines, {
              animate: true,
              padding: new mapkit.Padding({
                top: 200,
                right: 56,
                bottom: 100,
                left: 56
              })
            });
          }
        );
      }
    }, [randomPlace]);



    function* createUniqueRandomGenerator(places) {
      const available = places;

      while(available.length !== 0){
        const randomIndex = Math.floor(Math.random() * available.length);
        const value = available[randomIndex];

        available.splice(randomIndex, 1)
        yield value
      }
    }

    const handleUserLocationChange = (event) => {
      const {coordinate, timestamp} = event
      setStatus(STATUS.LOCATION_FOUND);
      setUserCoordinates(coordinate)
      console.log('User Location Changed', coordinate);
      map.removeEventListener('user-location-change', handleUserLocationChange)
      map.removeEventListener('user-location-error', handleUserLocationError)
    }

    const handleUserLocationError = (error) => {
      setStatus(STATUS.LOCATION_NOT_FOUND)
      console.warn(`Error ${error.code}, ${error.message}`)
    }

    const geocoderLookup = () => {
      //remove event listeners as location is being handled by the geocoder.
      setRadius(3000)
      map.removeEventListener('user-location-change', handleUserLocationChange)
      map.removeEventListener('user-location-error', handleUserLocationError)
      geocoder.lookup(locationQuery, (error, data)=>{
        if(data.results.length > 0){
          setStatus(STATUS.LOCATION_FOUND);
          setUserCoordinates(data.results[0].coordinate)
        } else {
          setStatus(STATUS.LOCATION_NOT_FOUND)
        }
      })
    }

    const renderLoadingScreen = () => {
      if (results.length === 0) {
        return (<div style={{height: '100%', width: '100%', position: 'absolute', zIndex: 100, backgroundColor: 'white'}}>
          <h1><a href="https://github.com/juancstlm/wthsige" >Where Should I Go To Eat</a></h1>
          <h2>Loading</h2>
          <h3>{status}</h3>
        </div>)
      } return null;
    }

    const renderLocationInputScreen = () => {
      if (geocoder && radius >= MAX_RADIUS || status === STATUS.LOCATION_NOT_FOUND) {
        return (<div style={{height: '100%', width: '100%', position: 'absolute', zIndex: 100, backgroundColor: 'white'}}>
          <h1><a href="https://github.com/juancstlm/wthsige" >Where Should I Go To Eat</a></h1>
          <h2>Loading</h2>
          <h3>{status}</h3>
          <input type='search' onChange={(e) => {
            setLocationQuery(e.target.value)
          }}/>
          <div style={{position: 'absolute', bottom: 100, zIndex: 10, left: 200}}>
            <button onClick={geocoderLookup}>Search</button>
          </div>
        </div>)
      } return null;
    }

    const searchForPlacesToEat = (searchRadius) => {
      setStatus(STATUS.LOOKING_FOR_RESULTS)
      //Create a new point of interest filter
      let filters = new mapkit.PointOfInterestFilter
        .including([mapkit.PointOfInterestCategory.Bakery, mapkit.PointOfInterestCategory.Cafe ,mapkit.PointOfInterestCategory.Restaurant])

      let pointOfInterestSearch = new mapkit.PointsOfInterestSearch({
        center: userCoordinates,
        pointOfInterestFilter: filters,
        radius: searchRadius,
      })

      pointOfInterestSearch.search((error, data) => {
        if (error) {
          // TODO handle error
          console.warn('error while searching ')
          return;
        }

        if (data.places.length === 0){
          //no places found increase the radius
          if(searchRadius < MAX_RADIUS){
            setRadius(searchRadius * 2)
            searchForPlacesToEat(searchRadius * 2)
          } else {
            setStatus(STATUS.NO_RESULTS_FOUND)
          }
        }
        else {
          setStatus(STATUS.RESULTS_FOUND);
          setRandomResultsGenerator(createUniqueRandomGenerator(data.places))
          setResults(data.places);
        }
      });
    }

    return (
      <>
        <h1>Why dont you eat Here?</h1>
        {renderLoadingScreen()}
        {renderLocationInputScreen()}
        <div id={'test'} style={{ width: '100%', margin: '0 auto', height: '100vh' }}>
          <Map {...mapProps} />
        </div>
        {results.length > 0 ? <div style={{position: 'absolute', bottom: 100, zIndex: 10, left: 200}}>
          <button onClick={()=> {
            setRandomPlace(randomResultGenerator.next().value)
          }}>No! That Place Looks Awful</button>
        </div> : null}
      </>
    )
  };


  return (
    <MapkitProvider tokenOrCallback={'https://api.wsigte.com/token'}>
      <UseMapExample/>
    </MapkitProvider>

  )
}
