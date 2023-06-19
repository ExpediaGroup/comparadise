import * as React from 'react';
import Island from '../resources/island.svg';

export const LoaderViews = {
  FULL_SCREEN: 'FULL_SCREEN',
  PARTIAL: 'PARTIAL',
} as const;
type View = keyof typeof LoaderViews;

export const Loader = ({ view }: { view: View }) => {
  return (
    <div className={`flex items-center justify-center ${getViewClass(view)}`}>
      <img
        className="w-1/6 animate-pulse"
        src={Island}
        alt="comparadise-loader"
      />
    </div>
  );
};

const getViewClass = (view: View) => {
  switch (view) {
    case LoaderViews.FULL_SCREEN:
      return 'min-h-screen';
    case LoaderViews.PARTIAL:
      return 'mt-48';
  }
};
