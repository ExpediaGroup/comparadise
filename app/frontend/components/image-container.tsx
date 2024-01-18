import * as React from 'react';
import { ImageView } from './view-toggle';
import { Loader, LoaderViews } from './loader';
import { RouterOutput } from '../utils/trpc';
import { ImageCanvas } from './image-canvas';

interface ImageContainerProps {
  viewType: ImageView;
  images: RouterOutput['fetchCurrentPage']['images'];
}

export const ImageContainer: React.FC<ImageContainerProps> = ({
  images,
  viewType
}) => {
  const [isImagesLoaded, setIsImagesLoaded] = React.useState(false);

  return (
    <div className="relative mt-8">
      <ImageCanvas
        viewType={viewType}
        images={images}
        setImageLoadedStatus={setIsImagesLoaded}
      />
      {!isImagesLoaded && (
        <div className="absolute bottom-0 left-0 right-0 top-0 backdrop-blur-sm">
          <div className="sticky top-1/3">
            <Loader view={LoaderViews.OVERLAY} />
          </div>
        </div>
      )}
    </div>
  );
};
