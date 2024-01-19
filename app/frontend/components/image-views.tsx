import React, { useState } from 'react';
import { RouterOutput } from '../utils/trpc';
import { PrimaryButton, SecondaryButton } from './buttons';
import { preloadImage } from './utils';
import { FILE_NAMES } from '../../backend/src/schema';

type Images = RouterOutput['fetchCurrentPage']['images'];
export type Image = Images[number];

interface SingleImageViewProps extends ImageViewChildProps {
  setImageLoadedStatus: (isLoaded: boolean) => void;
}

export const SingleImageView: React.FC<SingleImageViewProps> = ({
  images,
  setImageLoadedStatus
}) => {
  const [selectedImage, setSelectedImage] = React.useState<Image>();

  // React.useEffect(() => {
  //   if (images.length === 1 && images[0]?.name === FILE_NAMES.NEW) {
  //     setSelectedImage(images[0]);
  //   } else {
  //     const diffImage = images.find(img => img.name === FILE_NAMES.DIFF);
  //     setSelectedImage(diffImage);
  //   }
  // }, [images?.[0]?.url]);

  React.useEffect(() => {
    if (images.length === 1 && images[0]?.name === FILE_NAMES.NEW) {
      setSelectedImage(images[0]);
    } else {
      const diffImage = images.find(img => img.name === FILE_NAMES.DIFF);
      setSelectedImage(diffImage);
    }
  }, [images?.[0]?.url]);

  React.useEffect(() => {
    setImageLoadedStatus(false);
  }, [selectedImage?.url]);

  if (!selectedImage) {
    return <p>No images found.</p>;
  }

  return (
    <div className="mb-12 mt-5 flex justify-center">
      <div className="relative">
        <LazyImage
          src={selectedImage.url}
          alt={selectedImage.name}
          onLoadFinished={() => {
            setImageLoadedStatus(true);
          }}
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

interface ImageViewChildProps {
  images: Images;
  setImageLoadedStatus: (isLoaded: boolean) => void;
}
export const SideBySideImageView: React.FC<ImageViewChildProps> = ({
  images,
  setImageLoadedStatus
}) => {
  const [imagesLoaded, setImagesLoaded] = React.useState(false);

  React.useEffect(() => {
    Promise.allSettled(
      images.map(async image => {
        await preloadImage(image.url);
        return image;
      })
    ).then(() => {
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

export const LazyImage = (
  props: React.DetailedHTMLProps<
    React.ImgHTMLAttributes<HTMLImageElement>,
    HTMLImageElement
  > & { onLoadFinished?: () => void }
) => {
  const [currentSRC, setCurrentSRC] = useState(props.src);
  const { onLoadFinished, ...derivedProps } = props;

  React.useEffect(() => {
    if (props.src) {
      preloadImage(props.src).then(() => {
        onLoadFinished?.();
        setCurrentSRC(props.src);
      });
    }
  }, [props.src]);

  return <img key={currentSRC} {...derivedProps} src={currentSRC} />;
};
