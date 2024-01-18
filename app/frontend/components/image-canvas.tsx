import * as React from 'react';
import { ImageView, ImageViews } from './view-toggle';
import { Image, SideBySideImageView, SingleImageView } from './image-views';
import { RouterOutput } from '../utils/trpc';

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
