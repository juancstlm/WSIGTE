export const getResultsState = store => store.results;
export const getUserState = store => store.user;

// return the list of results
export const getResultPlaces = store =>
  store && store.results.places ? store.results.places : [];

export const getResultsBoundingRegion = store =>
  getResultsState(store).boundingRegion
    ? getResultsState(store).boundingRegion
    : null;

export const getRandomResult = store => {
  if (getResultPlaces(store)) {
    const randomIndex = Math.floor(
      Math.random() * getResultPlaces(store).length,
    );
    return getResultPlaces(store)[randomIndex];
  }
  return null;
};

export const showMap = store => getResultsState(store).showMap;

export const resultsAvailable = store =>
  getResultsState(store).places.length > 0;

export const getUserLocation = store =>
  getUserState(store) && getUserState(store).coordinates;
