import * as React from 'react';

export enum STATUS {
  INIT = 'Initializing',
  GETTING_YOUR_LOCATION ='Getting your location',
  LOCATION_FOUND = 'Location Found',
  LOOKING_FOR_RESULTS = 'Looking for Places to Eat',
  RESULTS_FOUND = 'Results Found',
  NO_RESULTS_FOUND = 'Out of Luck Chief',
  LOCATION_NOT_FOUND = 'We could not find you, try another address.'
}


interface OverlayProps {
  visible: boolean
  status: string
  title: string
}
export const Overlay: React.FC<OverlayProps> = ({visible, status, title }) => {
  return visible ?
      <div className='loadingScreenContainer'>
        <h1 className='loadingScreenTitle'>{title}</h1>
        {status === STATUS.INIT ? <p className='loadingScreenSubtitle'>Loading</p> : null}
        <p className='loadingScreenStatus'>{status}</p>
        {/*<input placeholder='Your Location' type='search' onChange={(e) => {*/}
        {/*  setLocationQuery(e.target.value)*/}
        {/*}}/>*/}
        {/*<div>*/}
        {/*  <button disabled={status=== STATUS.GETTING_YOUR_LOCATION} onClick={geocoderLookup}>Search</button>*/}
        {/*</div>*/}
      </div>: null;
}
