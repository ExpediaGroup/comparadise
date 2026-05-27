import { getInput } from '@actions/core';
import type { Deps } from './deps';

export async function resizeImageIfNeeded(
  buffer: Buffer,
  jimp: Deps['jimp']
): Promise<Buffer> {
  const resizeWidth = getInput('resize-width');
  const resizeHeight = getInput('resize-height');

  if (!resizeWidth && !resizeHeight) {
    return buffer;
  }
  const width = resizeWidth ? Number(resizeWidth) : undefined;
  const height = resizeHeight ? Number(resizeHeight) : undefined;
  if ((width && isNaN(width)) || (height && isNaN(height))) {
    throw new Error('resize-width and resize-height must be valid numbers');
  }

  const image = await jimp.read(buffer);
  if (width && height) {
    const scale = Math.min(width / image.width, height / image.height, 1);
    image.resize({
      w: Math.round(image.width * scale),
      h: Math.round(image.height * scale)
    });
  } else if (width) {
    image.resize({ w: width });
  } else if (height) {
    image.resize({ h: height });
  }

  return image.getBuffer('image/png');
}
