import * as React from 'react';
import { RouterOutput } from '../utils/trpc';
import { PrimaryButton, SecondaryButton } from './buttons';
import { FileName } from '../../backend/src/schema';

type Images = RouterOutput['fetchCurrentPage']['images'];
interface ImageViewChildProps {
  images: Images;
}

interface SingleImageViewProps extends ImageViewChildProps {
  selectedImage: FileName;
  setSelectedImage: (file: FileName) => void;
}

export const SingleImageView: React.FC<SingleImageViewProps> = ({
  images,
  selectedImage,
  setSelectedImage
}) => {
  const currentImage = images.find(image => image.name === selectedImage);
  const firstImageName = images.find(Boolean)?.name;
  if (!currentImage && firstImageName) {
    setSelectedImage(firstImageName);
    return null;
  }

  return (
    <div className="mb-12 mt-5 flex justify-center">
      <div className="fixed bottom-20">
        {images.map((image, index) => {
          const onClick = () => setSelectedImage(image.name);
          const Button =
            selectedImage === image.name ? PrimaryButton : SecondaryButton;
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
      <img src={currentImage?.url} alt={currentImage?.name} />
    </div>
  );
};

const getImageButtonStyles = (images: Images, imageIndex: number) => {
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

export const SideBySideImageView: React.FC<ImageViewChildProps> = ({
  images
}) => {
  return (
    <div className="flex justify-center">
      {images.map(image => (
        <div key={image.name}>
          <h2 className="text-center">{image.name}</h2>
          <img src={image.url} alt={image.name} />
        </div>
      ))}
    </div>
  );
};
