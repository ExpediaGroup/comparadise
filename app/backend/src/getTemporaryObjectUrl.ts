import { S3Client } from './s3Client';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export const getTemporaryObjectUrl = async (key: string, bucket: string) => {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(S3Client, command, { expiresIn: oneHour });
};

const oneHour = 3600;
