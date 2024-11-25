import * as React from 'react';
import { Island } from './island';

export const LandingPage = () => {
  return (
    <div className="m-10 flex flex-col items-center">
      <Island height={500} width={500} />
      <div className="m-10">
        <h1 className="text-4xl">Welcome to Comparadise</h1>
        <p className="text-xl">
          Please enter a valid url. For example:
          <br />
          https://COMPARADISE_HOST/?commitHash=COMMIT_HASH&owner=GITHUB_ORG&repo=REPO_NAME&bucket=S3_BUCKET_NAME
        </p>
      </div>
    </div>
  );
};
