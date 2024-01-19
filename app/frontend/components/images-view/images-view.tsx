import * as React from 'react';
import { ImageView, ImageViews } from '../view-toggle';
import { SideBySideImageView } from './side-by-side-image-view';
import { SingleImageView } from './single-image-view';
import { Images } from '../types';

interface ImageCanvasProps {
  viewType?: ImageView;
  images: Images;
  setImageLoadedStatus: (value: boolean) => void;
  isNextPageReady: boolean;
}
export const ImagesView: React.FC<ImageCanvasProps> = ({
  viewType,
  images,
  setImageLoadedStatus,
  isNextPageReady
}) => {
  const [currentView, setCurrentView] = React.useState(viewType);
  const [pageImages, setPageImages] = React.useState(images);

  React.useEffect(() => {
    if (isNextPageReady) {
      setCurrentView(viewType);
      setPageImages(images);
    }
  }, [isNextPageReady, viewType]);

  if (!currentView) {
    return null;
  }

  return currentView === ImageViews.SINGLE ? (
    <SingleImageView
      images={pageImages}
      setImageLoadedStatus={setImageLoadedStatus}
    />
  ) : (
    <SideBySideImageView
      images={pageImages}
      setImageLoadedStatus={setImageLoadedStatus}
    />
  );
};
