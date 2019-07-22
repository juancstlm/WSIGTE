import React from 'react';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { TransitionGroup, CSSTransition } from 'react-transition-group';
import { connect } from 'react-redux';
import {resultsAvailable} from '../Redux/selectors';

// Pages go here
import Locator from './Locator/Locator';
import Results from './Results/Results';

const Router = ({ resultsAvailable }) => {
  return (
    <BrowserRouter>
      <TransitionGroup>
        <CSSTransition
          key={window.location.key}
          timeout={300}
          classNames="fade"
        >
          <Switch location={window.location}>
            {/* <Route exact path="/" component={Locator} /> */}
            <Route
              path="/"
              render={() => (resultsAvailable ? <Results /> : <Locator />)}
            />
            <Route render={() => <div>Not Found</div>} />
          </Switch>
        </CSSTransition>
      </TransitionGroup>
    </BrowserRouter>
  );
};

export default connect(state => ({ resultsAvailable: resultsAvailable(state) }))(Router);
