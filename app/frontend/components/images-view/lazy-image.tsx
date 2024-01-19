import React from 'react';
import { preloadImage } from '../utils';

export const LazyImage = (
  props: React.DetailedHTMLProps<
    React.ImgHTMLAttributes<HTMLImageElement>,
    HTMLImageElement
  > & { onLoadFinished?: () => void }
) => {
  const [currentSRC, setCurrentSRC] = React.useState(props.src);
  const { onLoadFinished, ...derivedProps } = props;

  React.useEffect(() => {
    if (props.src) {
      preloadImage(props.src).then(() => {
        setCurrentSRC(props.src);
        onLoadFinished?.();
      });
    }
  }, [props.src]);

  return <img key={currentSRC} {...derivedProps} src={currentSRC} />;
};
