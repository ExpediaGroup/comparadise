import { Readable } from 'stream';
import { S3Client } from './s3Client';

export const getBase64StringFromS3 = async (key: string, bucket: string) => {
  const response = await S3Client.getObject({
    Bucket: bucket,
    Key: key
  });

  return streamToString(response.Body as Readable);
};

const streamToString = async (stream: Readable) => {
  const base64 = await new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
  });
  return `data:image/png;base64,${base64}`;
};
