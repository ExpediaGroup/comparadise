import * as React from 'react';
import { RouterOutput } from '../utils/trpc';
import { PrimaryButton, SecondaryButton } from './buttons';

type Images = RouterOutput['fetchCurrentPage']['images'];
interface ImageViewChildProps {
  images: Images;
}

interface SingleImageViewProps extends ImageViewChildProps {
  selectedImageIndex: number;
  onSelectImage: (index: number) => void;
}

export const SingleImageView: React.FC<SingleImageViewProps> = ({
  images,
  selectedImageIndex,
  onSelectImage
}) => {
  if (!images[selectedImageIndex]) {
    onSelectImage(0);
    return null;
  }

  return (
    <div className="mb-12 mt-5 flex justify-center">
      <div className="fixed bottom-20">
        {images.map((image, index) => {
          const onClick = () => onSelectImage(index);
          const Button =
            selectedImageIndex === index ? PrimaryButton : SecondaryButton;
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
      <img
        src={images[selectedImageIndex]?.url}
        alt={images[selectedImageIndex]?.name}
      />
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
