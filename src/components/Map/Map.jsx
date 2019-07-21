import React, { Component } from "react";
import PropTypes from "prop-types";
import './map.css'

const mapkit = window.mapkit;

class Map extends Component {
  constructor(props) {
    super(props);
  }

  componentWillMount() {}

  componentDidMount() {
    // console.log('mapkit',window)
    mapkit.init({
      authorizationCallback: function(done) {
        done(
          "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlA3WThWVTVaOU4ifQ.eyJpc3MiOiJCMjdRUjNBVUZKIiwiaWF0IjoxNTYzNTI2MDM3LCJleHAiOjE1NjQ1MDQ0Mzd9.7r4g4U-AmAuI2mKUVGmbwZGweaobvXC6x9ctwTrJsf2j7q2isb62T6bs_wMARpka3_WLT_jTLZ9hF7MGA6WDUw"
        );
      }
    });

    var Cupertino = new mapkit.CoordinateRegion(
      new mapkit.Coordinate(37.3316850890998, -122.030067374026),
      new mapkit.CoordinateSpan(0.167647972, 0.354985255)
    );

    var map = new mapkit.Map("map");
    map.region = Cupertino;
  }

  componentWillReceiveProps(nextProps) {}

  shouldComponentUpdate(nextProps, nextState) {}

  componentWillUpdate(nextProps, nextState) {}

  componentDidUpdate(prevProps, prevState) {}

  componentWillUnmount() {}

  render() {
    return <div id="map" className={"map"}></div>;
  }
}

Map.propTypes = {};

export default Map;
