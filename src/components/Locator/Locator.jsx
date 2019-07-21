import React, { useState, useEffect } from "react";
import "./locator.css";
import Form from "../Form/Form";
import { geolocated } from "react-geolocated";

const statusEnum = {
  LOOKING_FOR_LOCATION: 1,
  LOOKING_FOR_PLACES: 2,
  NO_PLACES_FOUND: 3,
  WAITING_FOR_LOCATION: 4,
  properties: {
    1: { icon: "📍", text: "Finding your Location" },
    2: { icon: "🔍", text: "Finding places to eat..." },
    3: { icon: "🖕", text: "Couldn't find anything, try somewhere else." },
    4: { icon: "📍", text: "Where are you?" }
  }
};

const Locator = ({ isGeolocationAvailable, coords, positionError }) => {
  const [status, setStatus] = useState(statusEnum.LOOKING_FOR_LOCATION);

  useEffect(() => {
    coords && setStatus(statusEnum.LOOKING_FOR_PLACES);
    positionError && setStatus(statusEnum.NO_PLACES_FOUND);
  }, [coords, positionError]);

  const handleFormSubmit = value => {
    console.log("Form submitted ", value);
    setStatus(statusEnum.LOOKING_FOR_PLACES);
  };

  const renderMessageText = () => {
    return statusEnum.properties[status].text;
  };

  const renderMessageIcon = () => {
    return statusEnum.properties[status].icon;
  };

  return (
    <div className={"Locator"}>
      <div className={"Locator-content"}>
        <div className={"Locator-message"}>
          <div className={"Locator-message-icon"}>
            <span role={"img"} aria-label={"search"}>
              {renderMessageIcon()}
            </span>
          </div>
          <div className={"Locator-message-text"}>{renderMessageText()}</div>
        </div>
        <Form
          onSubmit={handleFormSubmit}
          buttonText={"Find a place to eat"}
          inputPlaceholder={"Enter your location"}
        />
      </div>
    </div>
  );
};

export default geolocated({
  positionOptions: {
    enableHighAccuracy: true
  },
  userDecisionTimeout: 5000
})(Locator);
