import { s3Client } from './s3Client';

export const getTemporaryObjectUrl = async (key: string, bucket: string) => {
  return s3Client.presign(key, { bucket, expiresIn: oneHour });
};

const oneHour = 3600;
