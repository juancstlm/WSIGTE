import { SET_RESULTS, SET_USER_COORDINATES} from './actionTypes';

export const setResults = searchResponse => ({
  type: SET_RESULTS,
  places: searchResponse.places,
  boundingRegion: searchResponse.boundingRegion,
});

export const setUserCoordinates = coordinates => ({
  type: SET_USER_COORDINATES,
  coordinates,
});
