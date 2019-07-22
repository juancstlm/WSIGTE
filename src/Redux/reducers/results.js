import { SET_RESULTS, SET_SHOW_MAP } from '../actionTypes';

const initialState = {
  boundingRegion: null,
  places: [],
  showMap: false,
};

export default (state = initialState, action) => {
  const { type, showMap } = action;
  switch (type) {
    case SET_RESULTS:
      return {
        ...state,
        boundingRegion: action.boundingRegion,
        places: action.places,
      };
    case SET_SHOW_MAP:
      return {
        ...state,
        showMap,
      };
    default:
      return state;
  }
};
