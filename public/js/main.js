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
    authorizationCallback: done => {
      done(
        "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlA3WThWVTVaOU4ifQ.eyJpc3MiOiJCMjdRUjNBVUZKIiwiaWF0IjoxNTYwMTE3NDc1LCJleHAiOjE1NjI3OTU4NzV9.HIjUUQYD_82ztmIDMm6R-nWgkWI4NX6vVPcGqKO6GgWe1pVL3p76fIjoWX4KhLeiobhJ4xxllYHENKNtzbTASg"
      );
    }
  });

  var userCoordinate = new mapkit.Coordinate(
    position.coords.latitude,
    position.coords.longitude
  );

  const span = new mapkit.CoordinateSpan(0.03, 0.03);

  // TODO Fix the region to the search area
  const region = new mapkit.CoordinateRegion(userCoordinate, span);
  const map = new mapkit.Map("map", {
    region,
    showsUserLocationControl: true,
    showsScale: mapkit.FeatureVisibility.Visible
  });

  var search = new mapkit.Search({
    region: map.region
  });

  // Look for restaurants in their area
  search.search("restaurant", (error, data) => {
    if (error) {
      // TODO handle error
      return;
    }

    // Place the users location on the map via a MarkerAnnotation
    var userAnnotation = new mapkit.MarkerAnnotation(userCoordinate);
    userAnnotation.color = "#FFFFFF";
    userAnnotation.glyphText = "🤫";
    map.addAnnotation(userAnnotation);

    // Pick a random place from the list of search results
    let randomIndex = Math.floor(Math.random() * data.places.length);
    let randomPlace = data.places[randomIndex];
    let randomPlaceAnnotation = new mapkit.MarkerAnnotation(
      randomPlace.coordinate
    );
    randomPlaceAnnotation.color = "#2f3a49";
    randomPlaceAnnotation.title = randomPlace.name;
    randomPlaceAnnotation.subtitle = randomPlace.formattedAddress;

    // add the annotation to the map
    map.addAnnotation(randomPlaceAnnotation);

    new mapkit.Directions().route(
      {
        origin: userCoordinate,
        destination: randomPlace
      },
      (error, data) => {
        const polylines = data.routes.map(route => {
          console.log(route.polyline.points);
          return new mapkit.PolylineOverlay(route.polyline.points, {
            style: new mapkit.Style({
              lineWidth: 4,
              strokeColor: "#139cc2"
            })
          });
        });

        map.showItems(polylines);
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
