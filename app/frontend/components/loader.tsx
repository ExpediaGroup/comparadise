import * as React from 'react';
import { Island } from './island';

export const Loader: React.FC = () => {
  return (
    <div className="absolute bottom-0 left-0 right-0 top-0 backdrop-blur-sm">
      <div className="sticky top-1/3 flex justify-center">
        <div className="w-full max-w-60 animate-pulse">
          <Island />
        </div>
      </div>
    </div>
  );
};
