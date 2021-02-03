import Head from 'next/head'
import styles from '../styles/Home.module.css'
import { useEffect, useState } from 'react';
import { Map, MapkitProvider, Marker, useMap } from 'react-mapkit';

export default function Home() {

  const renderLoadingScreen = () => {
    return (<div style={{height: '100vh', width: '100vh'}}><h1>Loading</h1></div>)
  }

  const UseMapExample = () => {
    const { map, mapProps, setCenter, mapkit, setRegion, setVisibleMapRect } = useMap({showsUserLocation: true})
    const [position, setPosition] = useState();
    const [userCoordinates, setUserCoordinates] = useState()

    useEffect(()=>{
      if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(getPosition);
          }
          function getPosition(pos) {
            console.log(pos.coords.latitude, pos.coords.longitude);
            setPosition(pos)
          }
    }, [])

    useEffect(()=>{
      if(mapkit && position){
        let userCoordinate = new mapkit.Coordinate(
          position.coords.latitude,
          position.coords.longitude
        )
        setUserCoordinates(userCoordinate)
        let region = new mapkit.CoordinateRegion(userCoordinate);
        console.log(region)
        setRegion(region)
        setCenter([position.coords.latitude,
          position.coords.longitude])
      }

    }, [mapkit, position])

    const searchForPlacesToEat = () => {
      const searchParams = '93905';

      // let span = new mapkit.CoordinateSpan(0.016, 0.016);
      let filters = new mapkit.PointOfInterestFilter
        .including([mapkit.PointOfInterestCategory.Bakery, mapkit.PointOfInterestCategory.Cafe ,mapkit.PointOfInterestCategory.Restaurant])

      let pointOfInterestSearch = new mapkit.PointsOfInterestSearch({
        center: userCoordinates,
        pointOfInterestFilter: filters,
        radius: 3000,
      })

      // let search = new mapkit.Search({
      //   getsUserLocation: true,
      //   region: mapProps.region,
      //   includePointsOfInterest: true,
      //   pointOfInterestFilter:
      // })

      pointOfInterestSearch.search((error, data) => {
        if (error) {
          // TODO handle error
          return;
        }

        // Place the users location on the map via a MarkerAnnotation
        // let userAnnotation = new mapkit.MarkerAnnotation(userCoordinate);
        // userAnnotation.color = "#f96345";
        // userAnnotation.glyphText = "🏠";
        // map.addAnnotation(userAnnotation);

        // Pick a random place from the list of search results
        let randomIndex = Math.floor(Math.random() * data.places.length);
        let randomPlace = data.places[randomIndex];
        let randomPlaceAnnotation = new mapkit.MarkerAnnotation(
          randomPlace.coordinate
        );
        randomPlaceAnnotation.color = "#5688d9";
        randomPlaceAnnotation.title = randomPlace.name;
        randomPlaceAnnotation.subtitle = randomPlace.formattedAddress;

        // add the annotation to the map
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

            map.showItems(polylines, {
              animate: true,
              padding: new mapkit.Padding({
                top: 200,
                right: 50,
                bottom: 100,
                left: 50
              })
            });
          }
        );
      });
    }

    return (
      <>
        <h1><a href="https://github.com/juancstlm/wthsige" >Where should I go to eat?</a></h1>
        {/*<button onClick={searchForPlacesToEat}>Search</button>*/}
        <div id={'test'} style={{width: '100%', margin: '0 auto', height: '100vh' }}>
          <Map {...mapProps}  />
        </div>
      </>
    )
  }


  return (
    <MapkitProvider tokenOrCallback={'https://api.wsigte.com/token'}>
      <UseMapExample/>
    </MapkitProvider>

  )
}
