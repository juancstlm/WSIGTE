import { applyMiddleware, createStore } from 'redux';
import { createLogger } from 'redux-logger';
import freeze from 'redux-freeze';
import _ from 'lodash';
import rootReducer from './rootreducer';

const logger = createLogger();
const middleWares = _.compact([freeze, logger]);
const createStoreWithMiddleWare = applyMiddleware(...middleWares)(createStore);
const store = createStoreWithMiddleWare(rootReducer);

export default store;
