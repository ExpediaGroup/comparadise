import * as React from 'react';
import Island from '../resources/island.svg';

export const LoaderViews = {
  FULL_SCREEN: 'FULL_SCREEN',
  PARTIAL: 'PARTIAL',
  OVERLAY: 'OVERLAY'
} as const;
type View = keyof typeof LoaderViews;

export const Loader = ({ view }: { view: View }) => {
  return (
    <div className="flex items-center justify-center">
      <div className={getViewClass(view)}>
        <img
          className="w-full animate-pulse"
          src={Island}
          alt="comparadise-loader"
        />
      </div>
    </div>
  );
};

const getViewClass = (view: View) => {
  switch (view) {
    case LoaderViews.FULL_SCREEN:
      return `max-w-80`;
    case LoaderViews.PARTIAL:
      return `mt-48`;
    case LoaderViews.OVERLAY:
      return `max-w-60`;
  }
};
