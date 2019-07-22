import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './form.css';

const Form = ({ inputPlaceholder, onSubmit, buttonText, hidden }) => {
  const [value, setValue] = useState(null);

  const handleSubmit = e => {
    e && e.preventDefault();
    value && onSubmit && onSubmit(value);
  };

  const classes = hidden ? 'Form disabled' : 'Form';

  return (
    <form className={classes} onSubmit={handleSubmit}>
      <input
        className="Form-search-input"
        type="text"
        name="location"
        placeholder={inputPlaceholder}
        onChange={e => {
          setValue(e.target.value);
        }}
      />
      <button className="Form-button" type="submit">
        {buttonText}
      </button>
    </form>
  );
};

Form.defaultProps = {
  inputPlaceholder: 'Enter input here',
  buttonText: 'Submit',
};

Form.propTypes = {
  onSubmit: PropTypes.func,
  inputPlaceholder: PropTypes.string,
  buttonText: PropTypes.string,
  hidden: PropTypes.bool,
};

export default Form;
