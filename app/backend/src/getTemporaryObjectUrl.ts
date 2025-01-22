import { s3 } from 'bun';

export const getTemporaryObjectUrl = async (
  filePath: string,
  bucket: string
) => {
  return s3.file(filePath, { bucket }).presign({ expiresIn: oneHour });
};

const oneHour = 3600;
