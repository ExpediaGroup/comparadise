import { S3Client } from 'bun';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

const credentials = await defaultProvider()();
export const s3Client = new S3Client(credentials);
