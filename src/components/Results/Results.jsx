import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Map from '../Map/Map';
import { getRandomResult, getUserLocation } from '../../Redux/selectors';
import Header from "../Header/Header";

const { mapkit } = window;

class Results extends Component {
  constructor(props) {
    super(props);

    this.state = {
      polyline: null,
    };

    // create a route from the user to the random place
  }

  componentWillMount() {}

  componentDidMount() {
    const route = new mapkit.Directions().route(
      {
        origin: this.props.userCoordinates,
        destination: this.props.randomPlace,
      },
      (error, data) => {
        console.log('route ', data);
        const polylines = data.routes.map(route => {
          return new mapkit.PolylineOverlay(route.polyline.points, {
            style: new mapkit.Style({
              lineWidth: 5,
              strokeColor: '#139cc2',
            }),
          });
        });

        this.setState({ polyline: polylines });
        //
        // map.showItems(polylines, {
        //   animate: true,
        //   padding: new mapkit.Padding({
        //     top: 200,
        //     right: 50,
        //     bottom: 100,
        //     left: 50,
        //   }),
        // });
      },
    );
  }

  componentWillReceiveProps(nextProps) {}

  // shouldComponentUpdate(nextProps, nextState) {}

  componentWillUpdate(nextProps, nextState) {}

  componentDidUpdate(prevProps, prevState) {}

  componentWillUnmount() {}

  render() {
    return (
      <div>
        <Header/>
        <div>Why dont you go to : {this.props.randomPlace.name}</div>
        {this.state.polyline ? (
          <Map
            polylines={this.state.polyline}
            userCoordinate={this.props.userCoordinates}
            randomPlace={this.props.randomPlace}
          />
        ) : null}
        <div />
      </div>
    );
  }
}

Results.propTypes = {};

export default connect(
  state => ({
    randomPlace: getRandomResult(state),
    userCoordinates: getUserLocation(state),
  }),
  { getRandomResult },
)(Results);
