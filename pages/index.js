import Head from 'next/head'
import styles from '../styles/Home.module.css'
import { useEffect, useState } from 'react';
import { Map, MapkitProvider, Marker, useMap } from 'react-mapkit';

export default function Home() {

  const UseMapExample = () => {
    const { map, mapProps, setCenter, mapkit, setRegion, setVisibleMapRect } = useMap({showsUserLocation: true, tracksUserLocation: true})
    const [userCoordinates, setUserCoordinates] = useState()
    const [results, setResults] = useState()
    const [status, setStatus] =  useState('Getting your location')
    const [placeAnnotation, setPlaceAnnotation] = useState()
    const [path, setPath] = useState()
    const [eventListeners, setEventListeners] = useState([])
    const [radius, setRadius] = useState(3000);

    useEffect(()=>{
      if (map && eventListeners.length < 3) {
        map.addEventListener('user-location-change', handleUserLocationChange)
        setEventListeners([...eventListeners, 'user-location-change'])
        map.addEventListener('user-location-error',handleUserLocationError)
        setEventListeners([...eventListeners, 'user-location-error'])
      }
    }, [map])

    const handleUserLocationChange = (event) => {
      const {coordinate, timestamp} = event
      setUserCoordinates(coordinate)
      console.log('User Location Changed');
    }

    const handleUserLocationError = (error) => {
      console.warn(`Error ${error.code}, ${error.message}`)
    }

    useEffect(()=>{
      if(mapkit && userCoordinates){
        let region = new mapkit.CoordinateRegion(userCoordinates);
        setRegion(region)
        setCenter([userCoordinates.latitude,
          userCoordinates.longitude])
        searchForPlacesToEat()
      }

    }, [mapkit, userCoordinates, radius])

    const renderLoadingScreen = () => {
      if (!results) {
        return (<div style={{height: '100%', width: '100%', position: 'absolute', zIndex: 100, backgroundColor: 'white'}}>
          <h1><a href="https://github.com/juancstlm/wthsige" >Where Should I Go To Eat</a></h1>
          <h2>Loading</h2>
          <h3>{status}</h3>
        </div>)
      } return null;
    }

    const searchForPlacesToEat = () => {
      setStatus('Looking for Places')
      const searchParams = '93905';

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
        radius: radius,
      })

      pointOfInterestSearch.search((error, data) => {
        if (error) {
          // TODO handle error
          console.warn('error while searching ')
          return;
        }

        if (data.places.length === 0){
          //no places found increase the radius length by 1000
          radius < 30000 ? setRadius(radius + 1000) : setStatus('Out of Luck Chief')
        }
        else {
          // Place the users location on the map via a MarkerAnnotation
          let userAnnotation = new mapkit.MarkerAnnotation(userCoordinates);
          userAnnotation.color = "#f96345";
          userAnnotation.glyphText = "🏠";
          map.addAnnotation(userAnnotation);

          // Pick a random place from the list of search results
          let randomIndex = Math.floor(Math.random() * data.places.length);
          setResults(data.places);
          setStatus('Results found');
          let randomPlace = data.places[randomIndex];
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
      });
    }

    return (
      <>
        <h1>Why dont you eat Here?</h1>
        {renderLoadingScreen()}
        <div id={'test'} style={{ width: '100%', margin: '0 auto', height: '100vh' }}>
          <Map {...mapProps} />
        </div>
        {results ? <div style={{position: 'absolute', bottom: 100, zIndex: 10, left: 200}}>
          <button onClick={searchForPlacesToEat}>No! That Place Looks Awful</button>
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
