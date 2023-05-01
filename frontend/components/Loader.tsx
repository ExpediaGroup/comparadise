import * as React from 'react';
import Island from '../resources/Island.svg';
import { LoaderClasses, StyledGrid } from '../styles/loader';

export const Loader = () => {
  return (
    <StyledGrid className={LoaderClasses.grid} alignItems="center" justifyContent="center" container>
      <img className="loader" src={Island} alt="comparadise-loader" />
    </StyledGrid>
  );
};
