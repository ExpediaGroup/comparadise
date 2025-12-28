import { S3Client } from 'bun';
import { fromIni } from '@aws-sdk/credential-providers';

// Create S3Client with credentials loaded from ~/.aws/credentials and ~/.aws/config files
// This automatically picks up credentials, SSO tokens, and handles role assumptions without checking environment variables
const credentials = process.env.CI ? undefined : await fromIni()();
export const s3Client = new S3Client(credentials);
