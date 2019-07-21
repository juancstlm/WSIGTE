import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './form.css';

const Form = ({ inputPlaceholder, onSubmit, buttonText }) => {
  const [value, setValue] = useState(null);

  const handleSubmit = (e) => {
    e && e.preventDefault();
    onSubmit && onSubmit(value);
  };

  return (
    <form className="Form" onSubmit={handleSubmit}>
      <input
        className="Form-search-input"
        type="text"
        name="location"
        placeholder={inputPlaceholder}
        onChange={(e) => {
          setValue(e.target.value);
        }}
      />
      <button className="Form-button" type="submit">
        {buttonText}
      </button>
    </form>
  );
};

Form.propTypes = {
  onSubmit: PropTypes.func,
  inputPlaceholder: PropTypes.string,
  buttonText: PropTypes.string,
};

export default Form;
