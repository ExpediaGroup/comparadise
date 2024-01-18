import * as React from 'react';
import { ImageView, ImageViews } from './view-toggle';
import { Image, SideBySideImageView, SingleImageView } from './image-views';
import { RouterOutput } from '../utils/trpc';
import { FILE_NAMES } from '../../backend/src/schema';

interface ImageCanvasProps {
  viewType: ImageView;
  images: RouterOutput['fetchCurrentPage']['images'];
  setImageLoadedStatus: (value: boolean) => void;
}
export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  viewType,
  images,
  setImageLoadedStatus
}) => {
  const [selectedImage, setSelectedImage] = React.useState<Image>();

  React.useEffect(() => {
    if (images.length === 1 && images[0]?.name === FILE_NAMES.NEW) {
      setSelectedImage(images[0]);
    } else {
      const diffImage = images.find(img => img.name === FILE_NAMES.DIFF);
      setSelectedImage(diffImage);
    }
  }, [images]);

  return viewType === ImageViews.SINGLE ? (
    <SingleImageView
      images={images}
      setImageLoadedStatus={setImageLoadedStatus}
      selectedImage={selectedImage}
      setSelectedImage={setSelectedImage}
    />
  ) : (
    <SideBySideImageView
      images={images}
      setImageLoadedStatus={setImageLoadedStatus}
    />
  );
};
