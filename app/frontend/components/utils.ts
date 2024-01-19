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
  await Promise.allSettled(urls.map(url => preloadImage(url)));
};
