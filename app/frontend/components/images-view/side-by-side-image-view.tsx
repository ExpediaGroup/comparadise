import React from 'react';
import { Images } from '../types';
import { LazyImage } from './lazy-image';

interface SideBySideImageViewProps {
  images: Images;
  setImageLoadedStatus: (isLoaded: boolean) => void;
}
export const SideBySideImageView: React.FC<SideBySideImageViewProps> = ({
  images,
  setImageLoadedStatus
}) => {
  React.useEffect(() => {
    setImageLoadedStatus(true);
  }, []);

  return (
    <div className="flex justify-center">
      {images.map(image => (
        <div key={image.name}>
          <h2 className="text-center">{image.name}</h2>
          <LazyImage src={image.url} alt={image.name} />
        </div>
      ))}
    </div>
  );
};
