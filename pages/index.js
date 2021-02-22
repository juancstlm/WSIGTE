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
    const [results, setResults] = useState()
    const [status, setStatus] =  useState(STATUS.INIT)
    const [placeAnnotation, setPlaceAnnotation] = useState()
    const [path, setPath] = useState()
    const [eventListeners, setEventListeners] = useState([])
    const [radius, setRadius] = useState(3000);
    const [locationQuery, setLocationQuery] = useState('')
    const [geocoder, setGeocoder] = useState()

    //Add location listener to the map
    useEffect(()=>{
      // wait for the map to initialize and the event listeners to be empty
      if (map && eventListeners.length < 3 && status === STATUS.INIT) {
        map.addEventListener('user-location-change', handleUserLocationChange)
        setEventListeners([...eventListeners, 'user-location-change'])
        map.addEventListener('user-location-error',handleUserLocationError)
        setEventListeners([...eventListeners, 'user-location-error'])
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

        // Pick a random place from the list of search results
        let randomIndex = Math.floor(Math.random() * results.length);

        setStatus(STATUS.RESULTS_FOUND);
        let randomPlace = results[randomIndex];
        let randomPlaceAnnotation = new mapkit.MarkerAnnotation(
          randomPlace.coordinate
        );
        randomPlaceAnnotation.color = "#5688d9";
        randomPlaceAnnotation.title = randomPlace.name;
        randomPlaceAnnotation.subtitle = randomPlace.formattedAddress;

        // add the annotation to the map
        setPlaceAnnotation(randomPlaceAnnotation);
        map.addAnnotation(randomPlaceAnnotation);

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
    }, [results]);

    const handleUserLocationChange = (event) => {
      const {coordinate, timestamp} = event
      setStatus(STATUS.LOCATION_FOUND);
      setUserCoordinates(coordinate)
      console.log('User Location Changed', coordinate);
    }

    const handleUserLocationError = (error) => {
      console.warn(`Error ${error.code}, ${error.message}`)
    }

    const geocoderLookup = () => {
      //remove event listeners
      setRadius(3000)
      map.removeEventListener('user-location-change')
      map.removeEventListener('user-location-error')
      setEventListeners([])
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
      if (!results) {
        return (<div style={{height: '100%', width: '100%', position: 'absolute', zIndex: 100, backgroundColor: 'white'}}>
          <h1><a href="https://github.com/juancstlm/wthsige" >Where Should I Go To Eat</a></h1>
          <h2>Loading</h2>
          <h3>{status}</h3>
        </div>)
      } return null;
    }

    const renderLocationInputScreen = () => {
      if (geocoder && radius >= MAX_RADIUS) {
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

      if(placeAnnotation){
        map.removeAnnotation(placeAnnotation)
      }

      if(path){
        map.removeItems(path)
      }

      // let span = new mapkit.CoordinateSpan(0.016, 0.016);
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
          // radius < MAX_RADIUS ? setRadius(radius * 2) : setStatus(STATUS.NO_RESULTS_FOUND)
        }
        else {
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
        {results ? <div style={{position: 'absolute', bottom: 100, zIndex: 10, left: 200}}>
          <button onClick={()=>searchForPlacesToEat(radius)}>No! That Place Looks Awful</button>
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
