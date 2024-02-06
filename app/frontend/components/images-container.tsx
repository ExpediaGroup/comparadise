import * as React from 'react';
import { ImageView } from './view-toggle';
import { Loader } from './loader';
import { ImagesView } from './images-view';
import { Images } from './types';

interface ImageContainerProps {
  viewType?: ImageView;
  images: Images;
  isNextPageReady: boolean;
}

export const ImagesContainer: React.FC<ImageContainerProps> = ({
  images,
  viewType,
  isNextPageReady
}) => {
  const [isImagesLoaded, setIsImagesLoaded] = React.useState(false);

  return (
    <div className="relative">
      <ImagesView
        viewType={viewType}
        images={images}
        setImageLoadedStatus={setIsImagesLoaded}
        isNextPageReady={isNextPageReady}
      />
      {!isImagesLoaded && <Loader />}
    </div>
  );
};
