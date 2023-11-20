import React, { useState } from 'react';
import { RouterOutput } from '../utils/trpc';
import { PrimaryButton, SecondaryButton } from './buttons';
import { Loader, LoaderViews } from './loader';

type Images = RouterOutput['fetchCurrentPage']['images'];
interface ImageViewChildProps {
  images: Images;
}
export type Image = Images[number];

interface SingleImageViewProps extends ImageViewChildProps {
  selectedImage?: Image;
  setSelectedImage: (file: Image) => void;
}

export const SingleImageView: React.FC<SingleImageViewProps> = ({
  images,
  selectedImage,
  setSelectedImage
}) => {
  if (!selectedImage) {
    return <p>No images found.</p>;
  }

  return (
    <div className="mb-12 mt-5 flex justify-center">
      <div className="fixed bottom-20">
        {images.map((image, index) => {
          const onClick = () => setSelectedImage(image);
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
      <Image src={selectedImage.url} alt={selectedImage.name} />
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
          <Image src={image.url} alt={image.name} />
        </div>
      ))}
    </div>
  );
};

const Image = (
  props: React.DetailedHTMLProps<
    React.ImgHTMLAttributes<HTMLImageElement>,
    HTMLImageElement
  >
) => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      {isLoading && <Loader view={LoaderViews.PARTIAL} />}
      <img
        {...props}
        onLoad={() => setIsLoading(false)}
        className={isLoading ? 'hidden' : ''}
      />
    </>
  );
};
