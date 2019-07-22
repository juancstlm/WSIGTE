import React from 'react';
import './App.css';
import { Provider } from 'react-redux';
import Router from './components/Router';
import store from './Redux/store';

const { mapkit } = window;

mapkit.init({
  authorizationCallback(done) {
    done(
      // eslint-disable-next-line max-len
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlA3WThWVTVaOU4ifQ.eyJpc3MiOiJCMjdRUjNBVUZKIiwiaWF0IjoxNTYzNTI2MDM3LCJleHAiOjE1NjQ1MDQ0Mzd9.7r4g4U-AmAuI2mKUVGmbwZGweaobvXC6x9ctwTrJsf2j7q2isb62T6bs_wMARpka3_WLT_jTLZ9hF7MGA6WDUw',
    );
  },
});

function App() {
  return (
    <Provider store={store}>
      <div className="App">
        <Router />
      </div>
    </Provider>
  );
}

export default App;
