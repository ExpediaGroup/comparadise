import * as React from 'react';
import Island from '../resources/Island.svg';

export const Loader = () => {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <img className="w-1/6 animate-pulse" src={Island} alt="comparadise-loader" />
    </div>
  );
};
