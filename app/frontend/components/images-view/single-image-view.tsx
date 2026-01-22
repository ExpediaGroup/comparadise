import React from 'react';
import { FILE_NAMES } from '../../../backend/src/schema';
import { PrimaryButton, SecondaryButton } from '../buttons';
import { LazyImage } from './lazy-image';
import { Image, Images } from '../types';

export const getImageButtonStyles = (images: Images, imageIndex: number) => {
  if (images.length === 1) {
    return 'rounded-md';
  }
  switch (imageIndex) {
    case 0:
      return 'rounded-s-md rounded-e-none';
    case images.length - 1:
      return 'rounded-s-none rounded-e-md';
    default:
      return 'rounded-none';
  }
};

interface SingleImageViewProps {
  images: Images;
  setImageLoadedStatus: (isLoaded: boolean) => void;
}
export const SingleImageView: React.FC<SingleImageViewProps> = ({
  images,
  setImageLoadedStatus
}) => {
  const [selectedImage, setSelectedImage] = React.useState<Image>();

  React.useEffect(() => {
    if (images.length === 1) {
      setSelectedImage(images[0]);
    } else {
      const diffImage = images.find(img => img.name === FILE_NAMES.DIFF);
      const initialSelectedImage = diffImage ?? images[0];
      setSelectedImage(initialSelectedImage);
    }
  }, [images[0]?.url]);

  React.useEffect(() => {
    setImageLoadedStatus(false);
  }, []);

  if (!selectedImage) {
    return <p>No images found.</p>;
  }

  return (
    <div className="mt-5 mb-12 flex justify-center">
      <div className="relative">
        <LazyImage
          src={selectedImage.url}
          alt={selectedImage.name}
          beforeLoad={() => setImageLoadedStatus(false)}
          afterLoad={() => setImageLoadedStatus(true)}
        />
      </div>
      <div className="fixed bottom-20">
        {images.map((image, index) => {
          const onClick = () => {
            setSelectedImage(image);
          };
          const Button =
            selectedImage.name === image.name ? PrimaryButton : SecondaryButton;
          const extraStyles = getImageButtonStyles(images, index);
          return (
            <Button
              key={image.name}
              onClick={onClick}
              backgroundFilled
              className={`border border-slate-700 ${extraStyles}`}
            >
              {image.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
