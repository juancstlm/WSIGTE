import { combineReducers } from 'redux';

// reducers go here
import results from './reducers/results';
import user from './reducers/user';

const rootReducer = combineReducers({ results, user });

export default rootReducer;
