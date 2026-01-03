import { S3Client } from 'bun';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

// Create S3Client with credentials loaded from ~/.aws/credentials and ~/.aws/config files
// This automatically picks up credentials, SSO tokens, and handles role assumptions without checking environment variables
const credentials = process.env.CI ? undefined : await defaultProvider()();
export const s3Client = new S3Client(credentials);
