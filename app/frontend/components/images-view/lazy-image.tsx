import React from 'react';
import { preloadImage } from '../utils/image';

interface LazyImageProps {
  beforeLoad?: () => void;
  afterLoad?: () => void;
}

type LazyImageExtendedProps = React.DetailedHTMLProps<
  React.ImgHTMLAttributes<HTMLImageElement>,
  HTMLImageElement
> &
  LazyImageProps;

export const LazyImage: React.FC<LazyImageExtendedProps> = props => {
  const [currentSRC, setCurrentSRC] = React.useState(props.src);
  const { beforeLoad, afterLoad, ...derivedProps } = props;

  React.useEffect(() => {
    if (props.src) {
      beforeLoad?.();
      preloadImage(props.src).then(() => {
        setCurrentSRC(props.src);
        afterLoad?.();
      });
    }
  }, [props.src]);

  return <img key={currentSRC} {...derivedProps} src={currentSRC} />;
};
