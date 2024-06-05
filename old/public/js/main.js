const mapkit = window.mapkit;
const geolocation = navigator.geolocation.getCurrentPosition(
  showPosition,
  showError
);


// Request the browser for the location of the user
function showPosition(position) {
  console.log("Position request successful");

  // init mapkit
  mapkit.init({
    authorizationCallback: function(done) {
      fetch("https://api.wsigte.com/token")
        .then(res => res.text())
        .then(done);
    }
  });

  let userCoordinate = new mapkit.Coordinate(
    position.coords.latitude,
    position.coords.longitude
  );

  let span = new mapkit.CoordinateSpan(0.016, 0.016);

  let region = new mapkit.CoordinateRegion(userCoordinate);
  let map = new mapkit.Map("map", {
    region,
    showsUserLocationControl: true,
    showsMapTypeControl: false,
    showsScale: mapkit.FeatureVisibility.Visible
  });

  let search = new mapkit.Search({
    region: map.region
  });

  // Look for restaurants in their area
  search.search("restaurant", (error, data) => {
    if (error) {
      // TODO handle error
      return;
    }

    // Place the users location on the map via a MarkerAnnotation
    let userAnnotation = new mapkit.MarkerAnnotation(userCoordinate);
    userAnnotation.color = "#f96345";
    userAnnotation.glyphText = "🏠";
    map.addAnnotation(userAnnotation);

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
        origin: userCoordinate,
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

function showError() {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      alert("User denied the request for Geolocation.");
      break;
    case error.POSITION_UNAVAILABLE:
      alert("Location information is unavailable.");
      break;
    case error.TIMEOUT:
      alert("The request to get user location timed out.");
      break;
    case error.UNKNOWN_ERROR:
      alert("An unknown error occurred.");
      break;
  }
}
