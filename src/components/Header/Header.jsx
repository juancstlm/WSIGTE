import React from 'react';

const Header = () => {
  return (
    <nav className="navbar">
      <a>JC</a>
      <div className="collapse navbar-collapse" id="navbarNavAltMarkup">
        <div className="navbar-nav">
          <a className="nav-item nav-link active" href="#">Home <span
            className="sr-only">(current)</span></a>
          <a className="nav-item nav-link" href="#">Features</a>
          <a className="nav-item nav-link" href="#">Pricing</a>
          <a className="nav-item nav-link disabled" href="#">Disabled</a>
        </div>
      </div>
    </nav>
  );
};

export default Header;
