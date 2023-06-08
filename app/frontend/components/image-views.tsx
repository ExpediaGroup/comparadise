import * as React from 'react';
import { RouterOutput } from '../utils/trpc';
import { PrimaryButton, SecondaryButton } from './buttons';

interface ImageViewChildProps {
  images: RouterOutput['getImages'];
}

interface SingleImageViewProps extends ImageViewChildProps {
  selectedImageIndex: number;
  onSelectImage: (index: number) => void;
}

export const SingleImageView: React.FC<SingleImageViewProps> = ({ images, selectedImageIndex, onSelectImage }) => {
  if (!images[selectedImageIndex]) {
    onSelectImage(0);
    return null;
  }

  return (
    <div className="mb-12 mt-5 flex justify-center">
      <div className="fixed bottom-20">
        {images.map((image, index) => {
          const onClick = () => onSelectImage(index);
          const Button = selectedImageIndex === index ? PrimaryButton : SecondaryButton;
          const extraStyles =
            index === 0
              ? 'rounded-s-md rounded-e-none'
              : index === images.length - 1
              ? 'rounded-s-none rounded-e-md'
              : 'rounded-none';
          return (
            <Button key={image.name} onClick={onClick} backgroundFilled className={`border border-slate-700 ${extraStyles}`}>
              {image.name}
            </Button>
          );
        })}
      </div>
      <img src={images[selectedImageIndex].base64} alt={images[selectedImageIndex].name} />
    </div>
  );
};

export const SideBySideImageView: React.FC<ImageViewChildProps> = ({ images }) => {
  return (
    <div className="flex justify-center">
      {images.map(image => (
        <div key={image.name}>
          <h2 className="text-center">{image.name}</h2>
          <img src={image.base64} alt={image.name} />
        </div>
      ))}
    </div>
  );
};
