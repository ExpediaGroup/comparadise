import { S3Client } from 'bun';
import { fromIni } from '@aws-sdk/credential-providers';

/**
 * Gets S3 options by loading credentials from AWS credentials/config files.
 *
 * Uses fromIni() which reads from:
 * - ~/.aws/credentials (for access keys)
 * - ~/.aws/config (for SSO configurations, role assumptions, region, and endpoint)
 *
 * This provider automatically handles:
 * - Regular credentials from ~/.aws/credentials
 * - AWS SSO credentials (reads from ~/.aws/sso/cache/)
 * - Role assumptions configured in ~/.aws/config
 * - Web identity token files (if configured in ~/.aws/config)
 *
 * Note: This does NOT use environment variables at all - it only reads from credential/config files.
 * Note: Uses the 'default' profile from ~/.aws/credentials and ~/.aws/config.
 * Note: bucket is passed per-operation in the options parameter, not set on the client.
 */
const getS3Options = async () => {
  // Use fromIni() to read credentials from ~/.aws/credentials and ~/.aws/config
  // This handles regular credentials, SSO, role assumptions, and identity token files
  // All from the config files, no environment variables
  let accessKeyId: string | undefined;
  let secretAccessKey: string | undefined;
  let sessionToken: string | undefined;

  try {
    // Use 'default' profile - no environment variables needed
    const credentials = await fromIni()();
    accessKeyId = credentials.accessKeyId;
    secretAccessKey = credentials.secretAccessKey;
    sessionToken = credentials.sessionToken;
  } catch (error) {
    // If credential provider fails, credentials can be provided per-operation if needed
  }

  const options: {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    endpoint?: string;
    region?: string;
  } = {};

  if (accessKeyId) options.accessKeyId = accessKeyId;
  if (secretAccessKey) options.secretAccessKey = secretAccessKey;
  if (sessionToken) options.sessionToken = sessionToken;

  // Region and endpoint can be read from ~/.aws/config if needed
  // For now, they can be set per-operation if required

  return options;
};

// Create S3Client with credentials loaded from ~/.aws/credentials and ~/.aws/config files
// This automatically picks up credentials, SSO tokens, and handles role assumptions
// without checking environment variables
export const s3Client = new S3Client(await getS3Options());
