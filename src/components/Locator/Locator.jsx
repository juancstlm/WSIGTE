import React, { useState, useEffect } from 'react';
import './locator.css';
import { geolocated } from 'react-geolocated';
import PropTypes from 'prop-types';
import { Redirect } from 'react-router-dom';
import { connect } from 'react-redux';
import Form from '../Form/Form';
import { setResults, setUserCoordinates } from '../../Redux/actions';

const statusEnum = {
  LOOKING_FOR_LOCATION: 1,
  LOOKING_FOR_PLACES: 2,
  NO_PLACES_FOUND: 3,
  WAITING_FOR_LOCATION: 4,
  properties: {
    1: { icon: '📍', text: 'Finding your Location' },
    2: { icon: '🔍', text: 'Finding places to eat...' },
    3: { icon: '🖕', text: "Couldn't find anything, try somewhere else." },
    4: { icon: '📍', text: 'Where are you?' },
  },
};

const { mapkit } = window;

const geocoder = new mapkit.Geocoder({
  language: 'en-US',
  getsUserLocation: true,
});

// eslint-disable-next-line no-unused-vars
const Locator = ({
  isGeolocationAvailable,
  coords,
  positionError,
  setResults,
  setUserCoordinates,
}) => {
  const [status, setStatus] = useState(statusEnum.LOOKING_FOR_LOCATION);
  const [redirect, setRedirect] = useState(null);

  const lookForRecommendations = coordinate => {
    // initialize the search object
    const search = new mapkit.Search({
      getsUserLocation: true,
      coordinate,
    });

    // perform the search query
    search.search('Restaurants', (error, data) => {
      if (error) {
        console.log('error in search');
        return;
      }

      console.log('search data', data);
      setResults(data);
    });
  };

  useEffect(() => {
    //
    geocoder && console.log('geocoder loaded', geocoder);
    // initiate if the user location is available
    if (coords) {
      setStatus(statusEnum.LOOKING_FOR_PLACES);
      const userCoordinate = new mapkit.Coordinate(
        coords.latitude,
        coords.longitude,
      );

      setUserCoordinates(userCoordinate);

      lookForRecommendations(userCoordinate);
      // geocoder.reverseLookup(
      //   new mapkit.Coordinate(coords.latitude, coords.longitude),
      //   (error, data) => {
      //     if (error) {
      //       console.log('error in reverse lookup', error);
      //     }
      //     console.log(data);
      //   },
      // );
    }
    positionError && setStatus(statusEnum.NO_PLACES_FOUND);
  }, [coords, positionError]);

  const handleFormSubmit = value => {
    console.log('Form submitted ', value);
    setStatus(statusEnum.LOOKING_FOR_LOCATION);
    geocoder.lookup(value, (error, data) => {
      if (error) {
        console.log('Error in geocoder', error);
        setStatus(statusEnum.NO_PLACES_FOUND);
      }
      setStatus(statusEnum.LOOKING_FOR_PLACES);
      data.results[0] && setUserCoordinates(data.results[0].coordinate);
      console.log(data);
    });
  };

  const navigateTo = () => {
    return redirect && <Redirect to={redirect} />;
  };

  const renderMessageText = () => statusEnum.properties[status].text;

  const renderMessageIcon = () => statusEnum.properties[status].icon;

  return (
    <div className="Locator">
      <div className="Locator-content">
        <div className="Locator-message">
          <div className="Locator-message-icon">
            <span role="img" aria-label="search">
              {renderMessageIcon()}
            </span>
          </div>
          <div className="Locator-message-text">{renderMessageText()}</div>
        </div>
        <Form
          hidden={status === statusEnum.LOOKING_FOR_LOCATION}
          onSubmit={handleFormSubmit}
          buttonText="Find a place to eat"
          inputPlaceholder="Enter your location"
        />
      </div>
      {navigateTo()}
    </div>
  );
};

Locator.propTypes = {
  coords: PropTypes.instanceOf(navigator.geolocation),
  positionError: PropTypes.object,
  isGeolocationAvailable: PropTypes.bool,
};

export default connect(
  null,
  { setResults, setUserCoordinates },
)(
  geolocated({
    positionOptions: {
      enableHighAccuracy: true,
    },
    userDecisionTimeout: 9000,
  })(Locator),
);
