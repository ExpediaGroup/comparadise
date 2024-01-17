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
  const [isNextLoading, setIsNextLoading] = React.useState(false);

  React.useEffect(() => {
    setIsNextLoading(true);
  }, [selectedImage?.url]);

  if (!selectedImage) {
    return <p>No images found.</p>;
  }

  return (
    <div className="mb-12 mt-5 flex justify-center">
      <div className="relative">
        {isNextLoading && (
          <div className="absolute bottom-0 left-0 right-0 top-0 bg-gray-800/40 backdrop-blur-sm">
            <div className="sticky top-1/3">
              <Loader view={LoaderViews.OVERLAY} />
            </div>
          </div>
        )}
        <ImageComponent
          src={selectedImage.url}
          alt={selectedImage.name}
          onLoadFinished={() => setIsNextLoading(false)}
        />
      </div>
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
          <ImageComponent src={image.url} alt={image.name} />
        </div>
      ))}
    </div>
  );
};

const ImageComponent = (
  props: React.DetailedHTMLProps<
    React.ImgHTMLAttributes<HTMLImageElement>,
    HTMLImageElement
  > & { onLoadFinished?: () => void }
) => {
  const [currentSRC, setCurrentSRC] = useState(props.src);
  const { onLoadFinished, ...derrivedProps } = props;

  React.useEffect(() => {
    const loadImage = async () => {
      if (props.src) {
        const image = new Image();
        image.src = props.src;
        await image.decode();

        setCurrentSRC(props.src);
        onLoadFinished?.();
      }
    };

    loadImage().then(() => {});
  }, [props.src]);

  return <img key={props.src} {...derrivedProps} src={currentSRC} />;
};
