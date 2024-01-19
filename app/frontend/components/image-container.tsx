import * as React from 'react';
import { ImageView } from './view-toggle';
import { Loader } from './loader';
import { RouterOutput } from '../utils/trpc';
import { ImageCanvas } from './image-canvas';

interface ImageContainerProps {
  viewType?: ImageView;
  images: RouterOutput['fetchCurrentPage']['images'];
  isNextPageReady: boolean;
}

export const ImageContainer: React.FC<ImageContainerProps> = ({
  images,
  viewType,
  isNextPageReady
}) => {
  const [isImagesLoaded, setIsImagesLoaded] = React.useState(false);

  return (
    <div className="relative mt-8">
      <ImageCanvas
        viewType={viewType}
        images={images}
        setImageLoadedStatus={setIsImagesLoaded}
        isNextPageReady={isNextPageReady}
      />
      {!isImagesLoaded && <Loader />}
    </div>
  );
};
