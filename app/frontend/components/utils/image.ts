import { RouterOutput } from '../../utils/trpc';
import { ImageViews } from '../view-toggle';

export const preloadImage = async (url: string, elem?: HTMLImageElement) => {
  const image = elem || new Image();
  image.src = url;

  if (image.complete) {
    return image;
  }

  await image.decode();
  return image;
};

export const preloadAllImages = async (urls: string[]) => {
  return await Promise.allSettled(urls.map(url => preloadImage(url)));
};

const imageIsSmallEnoughForSideBySide = async (url: string) => {
  const image = await preloadImage(url);
  return 3 * image.naturalWidth < window.innerWidth;
};

export const getViewType = async (
  images: RouterOutput['fetchCurrentPage']['images']
) => {
  if (images.length === 1) {
    return ImageViews.SINGLE;
  }
  const diffImage = images[1]?.url;
  if (!diffImage) {
    return ImageViews.SINGLE;
  }

  const shouldViewSideBySide = await imageIsSmallEnoughForSideBySide(diffImage);
  return shouldViewSideBySide ? ImageViews.SIDE_BY_SIDE : ImageViews.SINGLE;
};
