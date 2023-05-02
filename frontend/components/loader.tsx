import * as React from 'react';
import Island from '../resources/Island.svg';

export const Loader = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <img className="animate-pulse w-1/6" src={Island} alt="comparadise-loader" />
    </div>
  );
};
