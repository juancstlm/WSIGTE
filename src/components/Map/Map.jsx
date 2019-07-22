import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './map.css';

const { mapkit } = window;

class Map extends Component {
  constructor(props) {
    super(props);
    // this.getQuerry()
    this.state = {
      map: null,
    };
  }

  componentWillMount() {}

  componentDidMount() {
    // create the coordinate region
    console.log('map props', this.props);
    const region = new mapkit.CoordinateRegion(this.props.userCoordinate);

    this.state.map = new mapkit.Map('map', {
      region,
      showsUserLocation: true,
      showsUserLocationControl: true,
      // colorScheme: 'MutedStandard',
      // visibleMapRect: new mapkit.MapRect(0, 0, 1, 1),
    });

    let userAnnotation = new mapkit.MarkerAnnotation(this.props.userCoordinate);
    userAnnotation.color = "#f96345";
    userAnnotation.glyphText = "🏠";
    this.state.map.addAnnotation(userAnnotation);

    let randomPlaceAnnotation = new mapkit.MarkerAnnotation(
      this.props.randomPlace.coordinate
    );
    randomPlaceAnnotation.color = "#5688d9";
    randomPlaceAnnotation.title = this.props.randomPlace.name;
    randomPlaceAnnotation.subtitle = this.props.randomPlace.formattedAddress;

    // add the annotation to the map
    this.state.map.addAnnotation(randomPlaceAnnotation);

    // display the route
    this.state.map.showItems(this.props.polylines, {
      animate: true,
      padding: new mapkit.Padding({
        top: 200,
        right: 50,
        bottom: 100,
        left: 50,
      }),
    });
  }

  componentWillReceiveProps(nextProps) {}

  // shouldComponentUpdate(nextProps, nextState) {}

  componentWillUpdate(nextProps, nextState) {}

  componentDidUpdate(prevProps, prevState) {}

  componentWillUnmount() {}

  render() {
    return <div id="map" className="map" />;
  }
}

Map.defaultProps = {};

Map.propTypes = {
  colorScheme: PropTypes.objectOf(mapkit.Map.ColorSchemes),
  visibleMapReact: PropTypes.objectOf(mapkit.MapRect),
};

export default Map;
