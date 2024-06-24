import * as React from "react";
import { MapkitProvider } from "react-mapkit";

import { ErrorBoundary } from "../components/ErrorBoundary";
import Map from "../components/Map";

export const STATUS = {
  INIT: "Initializing",
  GETTING_YOUR_LOCATION: "Getting your location",
  LOCATION_FOUND: "Location Found",
  LOOKING_FOR_RESULTS: "Looking for Places to Eat",
  RESULTS_FOUND: "Results Found",
  NO_RESULTS_FOUND: "Out of Luck Chief",
  LOCATION_NOT_FOUND: "We could not find you, try another address.",
};

export default function Home() {
  return (
    <ErrorBoundary>
      <MapkitProvider
        tokenOrCallback={
          "https://8q2oxsizal.execute-api.us-east-1.amazonaws.com/dev/token"
        }
      >
        <Map />
      </MapkitProvider>
    </ErrorBoundary>
  );
}
