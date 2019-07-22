import { SET_USER_COORDINATES } from '../actionTypes';

const initialState = {
  coordinates: null,
};

export default (state = initialState, action) => {
  const { type } = action;

  switch (type) {
    case SET_USER_COORDINATES:
      return {
        ...state,
        coordinates: action.coordinates,
      };
    default:
      return state;
  }
};
