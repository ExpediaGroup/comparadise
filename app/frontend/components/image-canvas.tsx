import * as React from 'react';
import { ImageView, ImageViews } from './view-toggle';
import { Image, SideBySideImageView, SingleImageView } from './image-views';
import { RouterOutput } from '../utils/trpc';
import { FILE_NAMES } from '../../backend/src/schema';

interface ImageCanvasProps {
  viewType: ImageView;
  images: RouterOutput['fetchCurrentPage']['images'];
  setImageLoadedStatus: (value: boolean) => void;
  isNextPageReady: boolean;
}
export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  viewType,
  images,
  setImageLoadedStatus,
  isNextPageReady
}) => {
  const [currentView, setCurrentView] = React.useState(viewType);
  const [imagesState, setImagesState] = React.useState(images);

  React.useEffect(() => {
    if (isNextPageReady) {
      setCurrentView(viewType);
      setImagesState(images);
    }
  }, [isNextPageReady, viewType]);

  return currentView === ImageViews.SINGLE ? (
    <SingleImageView
      images={imagesState}
      setImageLoadedStatus={setImageLoadedStatus}
    />
  ) : (
    <SideBySideImageView
      images={imagesState}
      setImageLoadedStatus={setImageLoadedStatus}
    />
  );
};
