import React from 'react';
import { preloadAllImages } from '../utils';
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
  const [imagesLoaded, setImagesLoaded] = React.useState(false);

  React.useEffect(() => {
    preloadAllImages(images.map(img => img.url)).then(() => {
      setImageLoadedStatus(true);
      setImagesLoaded(true);
    });

    return () => {
      setImageLoadedStatus(false);
      setImagesLoaded(false);
    };
  }, [images?.[0]?.url]);

  return (
    imagesLoaded && (
      <div className="flex justify-center">
        {images.map(image => (
          <div key={image.name}>
            <h2 className="text-center">{image.name}</h2>
            <LazyImage src={image.url} alt={image.name} />
          </div>
        ))}
      </div>
    )
  );
};
