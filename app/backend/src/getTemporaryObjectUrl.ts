import { s3Client } from 'shared/s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export const getTemporaryObjectUrl = async (key: string, bucket: string) => {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: oneHour });
};

const oneHour = 3600;
